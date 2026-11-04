"""Đánh giá STT + tách người nói + LLM trên bộ audio dựng từ TTS.

Chạy trong container ai-worker:
  python /check/eval/run_eval.py small clean white_snr20 ...
Ghi kết quả vào /check/eval/results/<model>_<variant>.json
"""

import asyncio
import itertools
import json
import os
import re
import sys
import time
import unicodedata

sys.path.insert(0, "/check/llm_bench")

from faster_whisper import WhisperModel, decode_audio  # noqa: E402

from app.worker.llm_analyzer import LlmAnalyzer, Settings as LlmSettings  # noqa: E402
from app.worker import whisper_transcriber  # noqa: E402
from app.worker.whisper_transcriber import Settings, WhisperTranscriber  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
# Từ điển thuật ngữ của dự án, đưa vào Whisper qua tham số hotwords (EVAL_HOTWORDS=1).
HOTWORDS = (
    "sprint, API, OTP, Firebase, eSMS, PostgreSQL, MongoDB, VNPay, MoMo, callback, Zalo, SMS, Swagger, query"
    if os.environ.get("EVAL_HOTWORDS") == "1"
    else ""
)
DATA = os.path.join(HERE, "data")
RES = os.path.join(HERE, "results")


DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
WEEKDAYS = {"2": "hai", "3": "ba", "4": "tư", "5": "năm", "6": "sáu", "7": "bảy"}


def vi_number(n: int) -> str:
    """Đọc số 0–99 thành chữ tiếng Việt để so khớp "12" với "mười hai"."""
    if n < 10:
        return DIGITS[n]
    tens, unit = divmod(n, 10)
    head = "mười" if tens == 1 else DIGITS[tens] + " mươi"
    if unit == 0:
        return head
    if unit == 5:
        return head + " lăm"
    if unit == 1 and tens > 1:
        return head + " mốt"
    if unit == 4 and tens > 1:
        return head + " tư"
    return head + " " + DIGITS[unit]


def norm_words(text: str, numbers: bool = False) -> list[str]:
    text = unicodedata.normalize("NFC", text).lower()
    if numbers:
        text = re.sub(r"thứ\s+([2-7])\b", lambda m: "thứ " + WEEKDAYS[m.group(1)], text)
        text = re.sub(r"\d+", lambda m: vi_number(int(m.group())) if int(m.group()) < 100 else m.group(), text)
    text = re.sub(r"[^\w\s]", " ", text)
    return text.split()


def edit_distance(a: list, b: list) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y))
        prev = cur
    return prev[-1]


def wer(ref: str, hyp: str, numbers: bool = False) -> float:
    r = norm_words(ref, numbers)
    return edit_distance(r, norm_words(hyp, numbers)) / max(1, len(r))


def cer(ref: str, hyp: str) -> float:
    r = list("".join(norm_words(ref)))
    return edit_distance(r, list("".join(norm_words(hyp)))) / max(1, len(r))


def overlap_s(a0, a1, b0, b1) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def speaker_eval(pred: list[dict], truth: list[dict]) -> dict:
    """Độ đúng người nói theo thời gian, ánh xạ nhãn máy ↔ người thật một-một tốt nhất."""
    labels = sorted({p["speakerLabel"] for p in pred})
    people = sorted({t["speaker"] for t in truth})
    m = {(l, s): 0.0 for l in labels for s in people}
    for p in pred:
        a0, a1 = p["startMs"] / 1000, p["endMs"] / 1000
        for t in truth:
            m[(p["speakerLabel"], t["speaker"])] += overlap_s(a0, a1, t["start"], t["end"])
    total = sum(m.values()) or 1.0
    best, best_map = -1.0, {}
    k = min(len(labels), len(people))
    for chosen in itertools.permutations(labels, k):
        for persons in itertools.permutations(people, k):
            score = sum(m[(l, s)] for l, s in zip(chosen, persons))
            if score > best:
                best, best_map = score, dict(zip(chosen, persons))
    # Nhãn thừa (không ánh xạ được) ghép vào người trùng nhiều nhất, chỉ để đặt tên.
    names = dict(best_map)
    for l in labels:
        if l not in names:
            names[l] = max(people, key=lambda s: m[(l, s)])
    return {
        "predicted_speakers": len(labels),
        "true_speakers": len(people),
        "accuracy": round(best / total, 4),
        "mapping": names,
    }


def overlap_eval(pred: list[dict], overlaps: list[list[float]]) -> dict:
    flagged = [p for p in pred if p.get("isOverlapping")]
    hit = sum(any(overlap_s(p["startMs"] / 1000, p["endMs"] / 1000, o0, o1) > 0 for p in flagged) for o0, o1 in overlaps)
    good = sum(any(overlap_s(p["startMs"] / 1000, p["endMs"] / 1000, o0, o1) > 0 for o0, o1 in overlaps) for p in flagged)
    return {"regions": len(overlaps), "detected": hit, "flagged_segments": len(flagged), "flagged_correct": good}


def noise_only_eval(pred: list[dict], window: list[float] | None) -> dict | None:
    if not window:
        return None
    inside = [p for p in pred if overlap_s(p["startMs"] / 1000, p["endMs"] / 1000, *window) > 0.5 * max(0.01, (p["endMs"] - p["startMs"]) / 1000)]
    return {"window_s": window, "segments_inside": len(inside), "texts": [p["text"] for p in inside]}


class Timed:
    """Bọc diarizer để đo riêng thời gian tách người nói."""

    def __init__(self, inner):
        self.inner, self.seconds = inner, 0.0

    def turns(self, *a, **kw):
        t = time.time()
        try:
            return self.inner.turns(*a, **kw)
        finally:
            self.seconds += time.time() - t


async def llm_scores(segments, mapping):
    import bench

    def as_input(named: bool):
        return [
            {"sequence": i, "speaker": (mapping.get(s["speakerLabel"], s["speakerLabel"]) if named else s["speakerLabel"]), "text": s["text"], "startMs": s["startMs"], "endMs": s["endMs"]}
            for i, s in enumerate(segments)
        ]

    analyzer = LlmAnalyzer(LlmSettings.from_env())
    out = {}
    for named in (False, True):
        t = time.time()
        r = await analyzer.analyze("eval", "eval", "vi", as_input(named))
        raw = {"summary": r.summary, "decisions": r.decisions, "openIssues": r.open_issues, "actionItems": r.action_items}
        sc = bench.score(raw)
        out["named" if named else "generic"] = {
            "model": r.model,
            "seconds": round(time.time() - t, 1),
            "points": sc["points"],
            "max": sc["max"],
            "notes": sc["notes"],
            "result": raw,
        }
    return out


def main():
    model_name, variants = sys.argv[1], sys.argv[2:]
    if HOTWORDS:
        whisper_transcriber.DECODE["hotwords"] = HOTWORDS
    with_llm = os.environ.get("EVAL_LLM", "0") == "1"
    os.makedirs(RES, exist_ok=True)
    t = time.time()
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    load_s = time.time() - t
    from app.worker.diarizer import Diarizer

    for variant in variants:
        meta = json.load(open(os.path.join(DATA, variant + ".json")))
        audio = decode_audio(os.path.join(DATA, variant + ".wav"), 16000)
        diarizer = Timed(Diarizer())
        tr = WhisperTranscriber(Settings(model=model_name, device="cpu"), model=model, diarizer=diarizer)
        t = time.time()
        result = tr.transcribe_audio(audio, "vi")
        total_s = time.time() - t
        ref = " ".join(s["text"] for s in meta["segments"])
        hyp = " ".join(s["text"] for s in result.segments)
        spk = speaker_eval(result.segments, meta["segments"])
        row = {
            "model": model_name,
            "variant": variant,
            "duration_s": meta["duration_s"],
            "load_s": round(load_s, 1),
            "total_s": round(total_s, 1),
            "diarization_s": round(diarizer.seconds, 1),
            "stt_s": round(total_s - diarizer.seconds, 1),
            "rtf": round(total_s / meta["duration_s"], 3),
            "wer": round(wer(ref, hyp), 4),
            "wer_num": round(wer(ref, hyp, numbers=True), 4),
            "hotwords": HOTWORDS or None,
            "cer": round(cer(ref, hyp), 4),
            "ref_words": len(norm_words(ref)),
            "language": result.language,
            "languages": result.languages,
            "segments": len(result.segments),
            "speaker": spk,
            "overlap": overlap_eval(result.segments, meta["overlaps"]) if meta.get("overlaps") else None,
            "noise_only": noise_only_eval(result.segments, meta.get("noise_only")),
            "hyp_segments": result.segments,
        }
        if with_llm:
            row["llm"] = asyncio.run(llm_scores(result.segments, spk["mapping"]))
        suffix = "_hw" if HOTWORDS else ""
        json.dump(row, open(os.path.join(RES, f"{model_name}{suffix}_{variant}.json"), "w"), ensure_ascii=False, indent=1)
        llm = row.get("llm") or {}
        print(
            f"{model_name:6}{'+hw' if HOTWORDS else ''} {variant:13} WER={row['wer']:.3f} WERnum={row['wer_num']:.3f} CER={row['cer']:.3f} RTF={row['rtf']:.2f} "
            f"stt={row['stt_s']}s diar={row['diarization_s']}s spk={spk['predicted_speakers']}/{spk['true_speakers']} acc={spk['accuracy']:.3f} "
            + (f"overlap={row['overlap']['detected']}/{row['overlap']['regions']} flagged_ok={row['overlap']['flagged_correct']}/{row['overlap']['flagged_segments']} " if row["overlap"] else "")
            + (f"noise_only_segs={row['noise_only']['segments_inside']} " if row["noise_only"] else "")
            + (f"LLM generic={llm['generic']['points']}/15 named={llm['named']['points']}/15" if llm else ""),
            flush=True,
        )


if __name__ == "__main__":
    main()
