"""Chọn vùng có tiếng nói để đưa vào Whisper.

Mặc định Whisper chạy sau bộ lọc Silero VAD. Silero bỏ sót gần hết khi tiếng nói
bị méo: phát lại qua loa rồi thu bằng micro có khử vọng, hoặc người nói xa
micro — bản ghi thật 296 s chỉ còn 3 s, transcript ra rỗng trong khi phiên âm
trực tiếp (cắt câu theo năng lượng) vẫn ra chữ. Nên so Silero với mức năng lượng:
Silero giữ quá ít thì cắt theo năng lượng, đúng cách trình duyệt cắt câu khi ghi
trực tiếp (meeting-mind-fe/src/lib/live-speaker.ts).
"""

from __future__ import annotations

import logging
import os

log = logging.getLogger("ai-worker")

SAMPLE_RATE = 16000


def energy_regions(
    audio,
    frame_s: float = 0.03,
    end_silence_s: float = 0.7,
    min_speech_s: float = 0.3,
    pad_s: float = 0.3,
    merge_gap_s: float = 1.0,
) -> list[tuple[float, float]]:
    """Các khoảng (giây) to hơn hẳn nền ồn; nền ồn tự cập nhật lúc im lặng."""
    import numpy as np

    size = int(frame_s * SAMPLE_RATE)
    count = len(audio) // size
    if count == 0:
        return []
    rms = np.sqrt((np.asarray(audio[: count * size], dtype=np.float32).reshape(count, size) ** 2).mean(axis=1))
    total_s = len(audio) / SAMPLE_RATE
    floor, loud, start, last = 0.005, 0, None, 0.0
    found: list[list[float]] = []
    for i, level in enumerate(rms.tolist()):
        t = (i + 1) * frame_s
        threshold = max(0.012, floor * 3.5)
        if level > threshold:
            loud += 1
            last = t
            if start is None and loud >= 3:
                start = t - 3 * frame_s
        else:
            loud = 0
            if start is not None and level > threshold * 0.7:
                last = t
            if start is None:
                floor = floor * 0.98 + min(level, threshold) * 0.02
        if start is not None and t - last > end_silence_s:
            if last - start >= min_speech_s:
                found.append([max(0.0, start - pad_s), min(total_s, last + pad_s)])
            start = None
    if start is not None and last - start >= min_speech_s:
        found.append([max(0.0, start - pad_s), min(total_s, last + pad_s)])
    merged: list[list[float]] = []
    for a, b in found:
        if merged and a - merged[-1][1] <= merge_gap_s:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(round(a, 2), round(b, 2)) for a, b in merged]


def silero_seconds(audio) -> float:
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    return sum(t["end"] - t["start"] for t in get_speech_timestamps(audio, VadOptions())) / SAMPLE_RATE


def speech_filter(audio) -> dict:
    """Tham số lọc tiếng nói cho model.transcribe().

    Bình thường để Silero lọc (tách câu mịn hơn, ít bịa ở đoạn ồn). Silero giữ
    dưới AI_VAD_FALLBACK_RATIO (0,6) lượng âm thanh có năng lượng thì cắt theo
    năng lượng. Lỗi bất kỳ thì giữ cách mặc định.
    """
    default = {"vad_filter": True}
    try:
        regions = energy_regions(audio)
        energy = sum(b - a for a, b in regions)
        if energy <= 0:
            return default
        silero = silero_seconds(audio)
        ratio = float(os.environ.get("AI_VAD_FALLBACK_RATIO", "0.6"))
        if silero >= ratio * energy:
            return default
        log.info("Silero chỉ giữ %.0f s trên %.0f s có tiếng: cắt theo năng lượng (%d vùng)", silero, energy, len(regions))
        return {"vad_filter": False, "clip_timestamps": [x for region in regions for x in region]}
    except Exception:  # noqa: BLE001 - lọc tiếng nói là phần phụ, không được làm hỏng phiên âm
        log.exception("Không so được Silero với năng lượng, dùng Silero")
        return default
