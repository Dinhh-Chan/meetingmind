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


def speech_probe(audio, seconds: float = 30.0):
    """Tối đa `seconds` giây đầu tiên CÓ tiếng nói, để nhận ngôn ngữ chính của bài.

    Whisper nhận ngôn ngữ bằng 30 giây đầu. Bản ghi bot Meet mở đầu bằng 40 giây im
    lặng (chưa ai bật mic) làm nó chọn tiếng Anh cho cả cuộc họp tiếng Việt. Không
    tìm thấy vùng có tiếng thì trả nguyên `audio`.
    """
    import numpy as np

    try:
        regions = energy_regions(audio)
    except Exception:  # noqa: BLE001 - chỉ là bước chọn mẫu
        return audio
    need = int(seconds * SAMPLE_RATE)
    parts, total = [], 0
    for start, end in regions:
        part = audio[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)][: need - total]
        parts.append(part)
        total += len(part)
        if total >= need:
            break
    # Dưới 3 giây thì không hơn gì đoán: để Whisper nghe cả đoạn đầu như trước.
    if total < 3 * SAMPLE_RATE:
        return audio
    return np.concatenate(parts)


def silero_seconds(audio) -> float:
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    return sum(t["end"] - t["start"] for t in get_speech_timestamps(audio, VadOptions())) / SAMPLE_RATE


def short_chunks(audio, size_s: float = 8.0) -> list[float]:
    """Vùng có tiếng theo năng lượng chia thành đoạn ≤ `size_s` giây, dạng clip_timestamps."""
    out: list[float] = []
    for start, end in energy_regions(audio):
        t = start
        while t < end:
            out += [round(t, 2), round(min(end, t + size_s), 2)]
            t += size_s
    return out


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
        total = len(audio) / SAMPLE_RATE
        # Nền ồn liên tục (quạt, phòng vang, micro laptop bật lọc ồn kém): "có tiếng" theo
        # năng lượng phủ gần hết bài nên cắt theo năng lượng chỉ ra một khối dài, Whisper
        # bỏ qua lời ở đầu khối rồi bịa câu ở cuối. Khi đó để Whisper nghe cả bài theo cửa
        # sổ 30 giây của nó (bản ghi 23/11: 0 câu → đủ các câu có hạn, người làm).
        if energy >= float(os.environ.get("AI_VAD_NOISY_COVERAGE", "0.8")) * total:
            log.info("Silero chỉ giữ %.0f s, nền ồn phủ %.0f/%.0f s: nghe cả bài, không cắt", silero, energy, total)
            return {"vad_filter": False}
        log.info("Silero chỉ giữ %.0f s trên %.0f s có tiếng: cắt theo năng lượng (%d vùng)", silero, energy, len(regions))
        return {"vad_filter": False, "clip_timestamps": [x for region in regions for x in region]}
    except Exception:  # noqa: BLE001 - lọc tiếng nói là phần phụ, không được làm hỏng phiên âm
        log.exception("Không so được Silero với năng lượng, dùng Silero")
        return default
