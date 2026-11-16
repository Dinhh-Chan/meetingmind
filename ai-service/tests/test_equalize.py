"""Cân bằng âm sắc: chỉ can thiệp khi bản ghi bị đục rõ, và đưa các dải hụt về gần mức chuẩn."""

import numpy as np

from app.worker import equalize as eq


def speech_like(seconds: float, tilt_db: dict | None = None, seed: int = 0):
    """Nhiễu có phổ như tiếng nói chuẩn (REFERENCE_DB), tuỳ chọn hạ bớt vài dải."""
    rng = np.random.default_rng(seed)
    n = int(seconds * eq.SAMPLE_RATE)
    spectrum = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / eq.SAMPLE_RATE)
    centers = np.array([(lo + hi) / 2 for lo, hi in eq.BANDS])
    levels = np.array(eq.REFERENCE_DB, dtype=float)
    for band, db in (tilt_db or {}).items():
        levels[band] += db
    spectrum *= 10 ** (np.interp(freqs, centers, levels) / 20)
    audio = np.fft.irfft(spectrum, n).astype(np.float32)
    return audio / np.abs(audio).max() * 0.5


def test_ban_ghi_binh_thuong_giu_nguyen():
    audio = speech_like(12)
    out, gains = eq.equalize(audio)
    assert gains is None and out is audio


def test_ban_ghi_duc_duoc_nang_ve_gan_muc_chuan():
    # Hụt 12–16 dB ở 1–2 kHz và 3–4 kHz như bản ghi bot Meet đo được.
    muffled = speech_like(12, {3: -12, 4: -14, 7: -10, 8: -16})
    before, _ = eq.band_profile(muffled)
    out, gains = eq.equalize(muffled)
    after, _ = eq.band_profile(out)
    assert gains is not None and gains[4] > 8 and gains[8] > 8
    ref = np.array(eq.REFERENCE_DB)
    assert np.abs(after - ref)[3:9].max() < np.abs(before - ref)[3:9].max() - 6
    assert np.abs(out).max() <= 0.95 + 1e-6 and len(out) == len(muffled)


def test_qua_ngan_hoac_khong_co_tieng_thi_khong_dong_vao():
    short = speech_like(4, {3: -12, 4: -14, 7: -10, 8: -16})
    assert eq.equalize(short)[1] is None
    silence = np.zeros(eq.SAMPLE_RATE * 12, dtype=np.float32)
    out, gains = eq.equalize(silence)
    assert gains is None and out is silence


def test_dai_khong_con_tieng_thi_khong_nang():
    # Bot Meet: trên 4 kHz gần như trống; nâng lên chỉ thêm nhiễu.
    narrow = speech_like(12, {3: -12, 4: -14, 9: -40, 10: -40, 11: -40})
    _, gains = eq.equalize(narrow)
    assert gains is not None and gains[9] == 0 and gains[10] == 0 and gains[11] == 0


def test_tat_bang_bien_moi_truong(monkeypatch):
    monkeypatch.setenv("AI_EQUALIZE", "0")
    muffled = speech_like(12, {3: -12, 4: -14, 7: -10, 8: -16})
    out, gains = eq.equalize(muffled)
    assert gains is None and out is muffled
