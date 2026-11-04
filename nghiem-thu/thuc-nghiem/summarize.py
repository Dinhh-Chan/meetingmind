"""Tổng hợp kết quả thực nghiệm thành bảng số liệu dùng cho báo cáo (results/summary.json)."""

import glob
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "llm_bench"))
os.environ.setdefault("FPT_AI_API_KEY", "unused")
import bench  # noqa: E402

TERMS = ["sprint", "API", "OTP", "Firebase", "eSMS", "PostgreSQL", "MongoDB", "VNPay", "MoMo", "callback", "Zalo", "SMS", "Swagger"]
WEEKDAY = {"2": "Hai", "3": "Ba", "4": "Tư", "5": "Năm", "6": "Sáu", "7": "Bảy"}


def norm(t: str) -> str:
    return unicodedata.normalize("NFC", t).lower()


def term_hits(ref: str, hyp: str) -> tuple[int, int]:
    """Số lần thuật ngữ xuất hiện trong bản chuẩn và số lần nhận đúng (đếm theo từng thuật ngữ, lấy min)."""
    total = hit = 0
    for term in TERMS:
        pat = re.compile(r"(?<![\w])" + re.escape(norm(term)) + r"(?![\w])")
        n_ref = len(pat.findall(norm(ref)))
        n_hyp = len(pat.findall(norm(hyp)))
        total += n_ref
        hit += min(n_ref, n_hyp)
    return hit, total


def lenient(raw: dict) -> dict:
    """Chấm lại sau khi chuẩn hoá cách viết thứ trong tuần ("thứ 4" → "thứ Tư")."""
    raw = json.loads(json.dumps(raw))
    for it in raw.get("actionItems") or []:
        d = it.get("deadlineRawText")
        if d:
            it["deadlineRawText"] = re.sub(r"thứ\s*([2-7])", lambda m: "thứ " + WEEKDAY[m.group(1)], d, flags=re.I)
    return bench.score(raw)


def main():
    rows = []
    for f in sorted(glob.glob(os.path.join(HERE, "results", "*.json"))):
        name = os.path.basename(f)[:-5]
        if name == "summary":
            continue
        r = json.load(open(f))
        meta = json.load(open(os.path.join(HERE, "data", r["variant"] + ".json")))
        ref = " ".join(s["text"] for s in meta["segments"])
        hyp = " ".join(s["text"] for s in r["hyp_segments"])
        hit, total = term_hits(ref, hyp)
        flagged = sum(1 for s in r["hyp_segments"] if s.get("isOverlapping"))
        row = {
            "run": name,
            "model": r["model"] + ("+hotwords" if r.get("hotwords") else ""),
            "variant": r["variant"],
            "wer": r["wer"],
            "wer_num": r["wer_num"],
            "cer": r["cer"],
            "terms": f"{hit}/{total}",
            "rtf": r["rtf"],
            "stt_s": r["stt_s"],
            "diar_s": r["diarization_s"],
            "speakers": f"{r['speaker']['predicted_speakers']}/{r['speaker']['true_speakers']}",
            "speaker_acc": r["speaker"]["accuracy"],
            "segments": r["segments"],
            "flagged_overlap": flagged,
            "overlap": r.get("overlap"),
            "noise_only": (r.get("noise_only") or {}).get("segments_inside"),
        }
        llm = r.get("llm") or {}
        for k in ("generic", "named"):
            if k in llm:
                row[f"llm_{k}"] = llm[k]["points"]
                row[f"llm_{k}_lenient"] = lenient(llm[k]["result"])["points"]
                row[f"llm_{k}_model"] = llm[k]["model"]
                row[f"llm_{k}_s"] = llm[k]["seconds"]
        rows.append(row)
    json.dump(rows, open(os.path.join(HERE, "summary.json"), "w"), ensure_ascii=False, indent=1)
    for r in rows:
        print(
            f"{r['model']:15} {r['variant']:13} WERnum={r['wer_num']*100:5.1f} CER={r['cer']*100:5.1f} terms={r['terms']:6} "
            f"spk={r['speakers']} acc={r['speaker_acc']*100:5.1f} flagged={r['flagged_overlap']:2} "
            f"LLM gen={r.get('llm_generic')}/{r.get('llm_generic_lenient')} named={r.get('llm_named')}/{r.get('llm_named_lenient')} "
            f"({r.get('llm_named_model')}, {r.get('llm_named_s')}s) rtf={r['rtf']}"
        )


if __name__ == "__main__":
    main()
