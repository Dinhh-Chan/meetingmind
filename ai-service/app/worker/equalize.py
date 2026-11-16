"""Cân bằng âm sắc bản ghi bị đục trước khi nhận dạng.

Âm thanh bot thu từ Google Meet có buổi mất hẳn dải 1–4 kHz (phụ âm nằm ở đó):
bản ghi một người đọc kịch bản qua Meet thấp hơn tiếng nói bình thường 11–17 dB ở
1–2 kHz và 3–4 kHz, Whisper bỏ sót cả đoạn và bịa câu tiếng Anh. Nâng các dải bị
hụt về mức tiếng nói bình thường thì tỷ lệ sai từ của bản ghép trên bản ghi đó giảm
từ ~68 % xuống ~60 % (lời chuẩn là kịch bản, người đọc có nói khác vài chỗ).

Chỉ can thiệp khi bản ghi lệch rõ so với phổ tiếng nói chuẩn; bản ghi bình thường
(micro laptop, bot Meet nghe rõ) giữ nguyên. Chỉ dùng cho nhận dạng chữ: tách người
nói vẫn nghe âm thanh gốc.
"""

from __future__ import annotations

import logging
import os

log = logging.getLogger("ai-worker")

SAMPLE_RATE = 16000
N_FFT = 512
HOP = 256

# Dải tần (Hz) và mức tiếng nói chuẩn của từng dải, dB so với trung bình 300–1000 Hz;
# đo trên 90 câu VIVOS test (micro gần, thu sạch).
BANDS = [
    (100, 300), (300, 600), (600, 1000), (1000, 1500), (1500, 2000), (2000, 2500),
    (2500, 3000), (3000, 3500), (3500, 4000), (4000, 5000), (5000, 6500), (6500, 8000),
]
REFERENCE_DB = [1.0, 1.0, -1.0, -7.0, -12.0, -15.0, -17.0, -19.0, -18.0, -23.0, -33.0, -38.0]

# Cần ngần này giây có tiếng mới ước lượng được phổ dài hạn (một câu ngắn ít âm xát
# trông cũng "đục").
MIN_SECONDS = 8.0
# Dải hụt từ ngần này dB mới coi là lệch; cần ít nhất hai dải lệch trong 1–4 kHz.
MIN_DEFICIT_DB = 6.0
MAX_GAIN_DB = 18.0
# Dải thấp hơn dải giữa quá mức này là không còn tiếng để nâng (bot Meet: trên 4 kHz).
EMPTY_DB = -42.0


def enabled() -> bool:
    return os.environ.get("AI_EQUALIZE", "1") not in ("0", "false")


def _window():
    import numpy as np

    return np.sqrt(np.hanning(N_FFT + 1)[:-1]).astype(np.float32)


def _stft(audio):
    import numpy as np

    pad = np.concatenate([np.zeros(N_FFT, np.float32), audio, np.zeros(N_FFT, np.float32)])
    frames = np.lib.stride_tricks.sliding_window_view(pad, N_FFT)[::HOP] * _window()
    return np.fft.rfft(frames, axis=1)


def _istft(spectrum, length: int):
    import numpy as np

    frames = np.fft.irfft(spectrum, N_FFT, axis=1).astype(np.float32) * _window()
    out = np.zeros((len(frames) - 1) * HOP + N_FFT, np.float32)
    for i, frame in enumerate(frames):
        out[i * HOP : i * HOP + N_FFT] += frame
    return out[N_FFT : N_FFT + length]


def band_profile(audio):
    """Mức từng dải (dB so với trung bình 300–1000 Hz) trên các khung to nhất, và số giây có tiếng.

    Trả (None, 0.0) khi bản ghi không có tiếng.
    """
    import numpy as np

    power = np.abs(_stft(np.asarray(audio, dtype=np.float32))) ** 2
    energy = power.sum(axis=1)
    live = energy > 1e-9  # Meet gửi số 0 tuyệt đối khi không ai nói
    if not live.any():
        return None, 0.0
    loud = live & (energy >= np.percentile(energy[live], 60))
    mean = power[loud].mean(axis=0)
    freqs = np.fft.rfftfreq(N_FFT, 1 / SAMPLE_RATE)
    levels = np.array([10 * np.log10(mean[(freqs >= lo) & (freqs < hi)].mean() + 1e-20) for lo, hi in BANDS])
    return levels - levels[1:3].mean(), float(live.sum() * HOP / SAMPLE_RATE)


def gains_db(profile, seconds: float):
    """Số dB cần nâng từng dải; None khi bản ghi không lệch (hoặc quá ngắn để biết)."""
    import numpy as np

    if profile is None or seconds < MIN_SECONDS:
        return None
    deficit = np.clip(np.asarray(REFERENCE_DB) - profile, 0.0, MAX_GAIN_DB)
    deficit[profile < EMPTY_DB] = 0.0
    speech_band = np.array([1000 <= lo < 4000 for lo, _ in BANDS])
    if int((deficit[speech_band] >= MIN_DEFICIT_DB).sum()) < 2:
        return None
    return deficit


def equalize(audio):
    """Bản ghi đã nâng các dải bị hụt (hoặc chính `audio` nếu không cần), kèm số dB nâng từng dải."""
    import numpy as np

    if not enabled() or len(audio) < N_FFT:
        return audio, None
    profile, seconds = band_profile(audio)
    gains = gains_db(profile, seconds)
    if gains is None:
        return audio, None
    freqs = np.fft.rfftfreq(N_FFT, 1 / SAMPLE_RATE)
    centers = np.array([(lo + hi) / 2 for lo, hi in BANDS])
    curve = 10 ** (np.interp(freqs, centers, gains) / 20)
    out = _istft(_stft(np.asarray(audio, dtype=np.float32)) * curve, len(audio))
    peak = float(np.abs(out).max())
    if peak > 0.95:
        out = out * (0.95 / peak)
    log.info(
        "Bản ghi bị đục, nâng (dB) %s",
        ", ".join(f"{lo}–{hi} Hz: +{g:.0f}" for (lo, hi), g in zip(BANDS, gains) if g >= 1),
    )
    return out.astype(np.float32), gains
