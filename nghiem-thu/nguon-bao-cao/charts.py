"""Vẽ biểu đồ kết quả thực nghiệm từ file số liệu thật (không nhập tay con số)."""

import glob
import re
import json
import os
import statistics as st
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIG = os.path.join(SP, "report", "figures")
BENCH = os.path.join(SP, "llm_bench", "out")
RES = os.path.join(SP, "eval", "results")

NAVY, BLUE, LIGHTBLUE, ORANGE, GREY = "#1F3A5F", "#2E6DA4", "#9DBCE0", "#D9822B", "#9CA3AF"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 12, "axes.spines.top": False, "axes.spines.right": False})


def llm_summary() -> list[dict]:
    """Gộp các lần chạy benchmark: model → điểm trung bình, độ trễ, chi phí."""
    runs: dict[str, list[dict]] = {}
    for f in glob.glob(os.path.join(BENCH, "*.json")):
        r = json.load(open(f))
        if r.get("status") != 200:
            continue
        base = os.path.basename(f)[:-5]
        # File lượt lặp có dạng <tên>.<k>.json; file lượt đầu là <tên>.json.
        multi = base != re.sub(r"[^A-Za-z0-9.-]", "_", r["model"])
        runs.setdefault(r["model"], []).append({**r, "_multi": multi})
    rows = []
    for model, rs in runs.items():
        # Có lượt chạy lặp (không bật response_format) thì chỉ dùng các lượt đó.
        if any(x["_multi"] for x in rs):
            rs = [x for x in rs if x["_multi"]]
        scores = [x["score"]["points"] if x.get("score") else 0 for x in rs]
        rows.append(
            {
                "model": model,
                "runs": len(rs),
                "scores": scores,
                "mean": st.mean(scores),
                "seconds": st.mean(x["seconds"] for x in rs),
                "cost": st.mean((x.get("cost") or 0) for x in rs),
                "parse_fail": sum(1 for x in rs if not x.get("score")),
            }
        )
    return sorted(rows, key=lambda r: (-r["mean"], r["seconds"]))


def fig_llm_models():
    rows = llm_summary()
    json.dump(rows, open(os.path.join(FIG, "llm_summary.json"), "w"), indent=1, ensure_ascii=False)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 5.2), gridspec_kw={"width_ratios": [1.25, 1]})
    names = [r["model"] for r in rows]
    colors = [ORANGE if r["model"] == "DeepSeek-V4.1-Flash" else (BLUE if r["model"] == "GLM-5.2" else LIGHTBLUE) for r in rows]
    a1.barh(names[::-1], [r["mean"] for r in rows][::-1], color=colors[::-1])
    for i, r in enumerate(rows[::-1]):
        a1.text(r["mean"] + 0.2, i, f"{r['mean']:.1f} ({r['runs']} lần)", va="center", fontsize=10)
    a1.set_xlim(0, 17.5)
    a1.set_xlabel("Điểm trung bình (tối đa 15)")
    a1.set_title("Độ đúng trích xuất biên bản", fontsize=13, color=NAVY)
    a2.scatter([r["seconds"] for r in rows], [r["mean"] for r in rows], s=90, c=colors, edgecolors=NAVY, zorder=3)
    offsets = {"Llama-3.3-70B-Instruct": (6, -14), "DeepSeek-V4.1-Flash": (-130, -16), "gemma-4-26B-A4B-it": (6, -12)}
    for r in rows:
        a2.annotate(r["model"].replace("-Instruct", ""), (r["seconds"], r["mean"]), textcoords="offset points", xytext=offsets.get(r["model"], (6, 4)), fontsize=9)
    a2.set_xlim(0, max(r["seconds"] for r in rows) * 1.1)
    a2.set_xlabel("Thời gian phản hồi trung bình (giây)")
    a2.set_ylabel("Điểm trung bình")
    a2.set_ylim(-0.5, 16)
    a2.set_title("Độ đúng so với độ trễ", fontsize=13, color=NAVY)
    a2.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, "fig-llm-models.png"), dpi=200)
    print("fig-llm-models.png")


def load_results() -> dict:
    out = {}
    for f in glob.glob(os.path.join(RES, "*.json")):
        r = json.load(open(f))
        out[os.path.basename(f)[:-5]] = r
    return out


LABELS = {
    "clean": "Sạch",
    "white_snr20": "Nhiễu trắng\n20 dB",
    "white_snr10": "Nhiễu trắng\n10 dB",
    "white_snr5": "Nhiễu trắng\n5 dB",
    "babble_snr10": "Đông người\n10 dB",
    "overlap": "Nói chồng\n+ đoạn nhiễu",
}


def fig_wer():
    res = load_results()
    variants = [v for v in LABELS if f"small_{v}" in res]
    if not variants:
        print("chưa có kết quả small_*")
        return
    fig, ax = plt.subplots(figsize=(12, 5))
    x = range(len(variants))
    series = [("small", "Whisper small", BLUE), ("small_hw", "small + từ điển thuật ngữ", ORANGE), ("medium", "Whisper medium", NAVY)]
    width = 0.26
    for k, (key, label, color) in enumerate(series):
        vals = [res.get(f"{key}_{v}", {}).get("wer_num") for v in variants]
        xs = [i + (k - 1) * width for i in x]
        bars = [(xx, vv) for xx, vv in zip(xs, vals) if vv is not None]
        if not bars:
            continue
        ax.bar([b[0] for b in bars], [b[1] * 100 for b in bars], width=width, color=color, label=label)
        for xx, vv in bars:
            ax.text(xx, vv * 100 + 0.8, f"{vv*100:.1f}", ha="center", fontsize=9)
    ax.set_xticks(list(x))
    ax.set_xticklabels([LABELS[v] for v in variants])
    ax.set_ylabel("WER (%) — đã chuẩn hoá cách viết số")
    ax.set_title("Tỷ lệ lỗi từ theo điều kiện âm thanh", fontsize=13, color=NAVY)
    ax.legend(frameon=False)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, "fig-wer.png"), dpi=200)
    print("fig-wer.png")


def fig_timing():
    res = load_results()
    # small + từ điển bị đo lúc máy đang bận việc khác nên không đưa vào so sánh thời gian.
    keys = [k for k in ("small_clean", "medium_clean") if k in res]
    if not keys:
        print("chưa có kết quả timing")
        return
    fig, ax = plt.subplots(figsize=(11, 3.4))
    labels = {"small_clean": "Whisper small", "small_hw_clean": "small + từ điển", "medium_clean": "Whisper medium"}
    for i, k in enumerate(keys):
        r = res[k]
        llm = (r.get("llm") or {}).get("named", {}).get("seconds", 0)
        parts = [("Nhận dạng tiếng nói", r["stt_s"], BLUE), ("Tách người nói", r["diarization_s"], LIGHTBLUE), ("Phân tích LLM", llm, ORANGE)]
        left = 0
        for name, val, color in parts:
            ax.barh(labels[k], val, left=left, color=color, label=name if i == 0 else None)
            if val > 8:
                ax.text(left + val / 2, i, f"{val:.0f}s", ha="center", va="center", color="white", fontsize=10)
            left += val
        ax.text(left + 4, i, f"tổng {left:.0f}s cho {r['duration_s']:.0f}s audio", va="center", fontsize=10)
    ax.set_xlabel("Thời gian xử lý (giây) — CPU Intel i7-10750H, không GPU")
    ax.set_title("Thời gian xử lý một cuộc họp 2,5 phút", fontsize=13, color=NAVY)
    ax.legend(frameon=False, loc="lower right")
    ax.set_xlim(0, max(ax.get_xlim()[1], 10) * 1.25)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, "fig-timing.png"), dpi=200)
    print("fig-timing.png")


if __name__ == "__main__":
    os.makedirs(FIG, exist_ok=True)
    which = sys.argv[1:] or ["llm", "wer", "timing"]
    if "llm" in which:
        fig_llm_models()
    if "wer" in which:
        fig_wer()
    if "timing" in which:
        fig_timing()
