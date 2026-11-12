"""Chọn vùng tiếng nói: Silero bỏ sót thì cắt theo năng lượng."""

import numpy as np

from app.worker import speech_regions
from app.worker.speech_regions import SAMPLE_RATE, energy_regions, speech_filter


def _audio(*parts):
    """parts: (giây, biên độ) nối tiếp; biên độ > 0 là nhiễu trắng to cỡ đó."""
    rng = np.random.default_rng(1)
    return np.concatenate([a * rng.standard_normal(int(s * SAMPLE_RATE)).astype(np.float32) for s, a in parts])


def test_vung_to_hon_nen_on_co_dem_hai_dau():
    audio = _audio((2, 0.001), (3, 0.05), (4, 0.001), (2, 0.05), (2, 0.001))
    regions = energy_regions(audio)
    assert len(regions) == 2
    (a0, b0), (a1, b1) = regions
    assert 1.5 < a0 < 2.0 and 5.0 < b0 < 5.6
    assert 8.5 < a1 < 9.0 and 11.0 < b1 < 11.6


def test_hai_vung_gan_nhau_gop_lam_mot_va_tieng_ngan_bi_bo():
    audio = _audio((1, 0.001), (2, 0.05), (1.2, 0.001), (2, 0.05), (3, 0.001), (0.1, 0.05), (2, 0.001))
    assert len(energy_regions(audio)) == 1


def test_im_lang_thi_de_silero_loc():
    assert speech_filter(np.zeros(5 * SAMPLE_RATE, dtype=np.float32)) == {"vad_filter": True}


def test_silero_giu_qua_it_thi_cat_theo_nang_luong(monkeypatch):
    audio = _audio((2, 0.001), (10, 0.05), (2, 0.001))
    monkeypatch.setattr(speech_regions, "silero_seconds", lambda a: 1.0)
    chosen = speech_filter(audio)
    assert chosen["vad_filter"] is False
    start, end = chosen["clip_timestamps"]
    assert 1.5 < start < 2.0 and 12.0 < end < 12.6


def test_silero_giu_du_thi_khong_doi(monkeypatch):
    audio = _audio((2, 0.001), (10, 0.05), (2, 0.001))
    monkeypatch.setattr(speech_regions, "silero_seconds", lambda a: 9.0)
    assert speech_filter(audio) == {"vad_filter": True}


def test_loi_silero_thi_giu_mac_dinh(monkeypatch):
    def boom(a):
        raise RuntimeError("no onnx")

    monkeypatch.setattr(speech_regions, "silero_seconds", boom)
    assert speech_filter(_audio((1, 0.001), (5, 0.05))) == {"vad_filter": True}
