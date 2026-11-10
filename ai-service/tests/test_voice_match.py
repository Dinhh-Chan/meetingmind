"""Ghép nhãn người nói với người đã đăng ký giọng: hàm thuần, không cần model."""

import numpy as np
import pytest

from app.worker import voice


def unit(*xs):
    v = np.array(xs, dtype=np.float32)
    return v / np.linalg.norm(v)


def test_ghep_dung_nguoi_giong_nhat():
    centroids = {"Người nói 1": unit(1, 0, 0), "Người nói 2": unit(0, 1, 0)}
    profiles = [
        {"userId": "lan", "embedding": unit(0.1, 0.95, 0).tolist()},
        {"userId": "nam", "embedding": unit(0.9, 0.1, 0).tolist()},
    ]
    m = voice.match(centroids, profiles, threshold=0.5)
    assert m["Người nói 1"]["userId"] == "nam"
    assert m["Người nói 2"]["userId"] == "lan"
    assert 0.5 <= m["Người nói 1"]["score"] <= 1


def test_moi_nguoi_chi_mot_nhan():
    # Hai giọng đều gần "nam": chỉ giọng giống nhất được ghép, giọng kia giữ nhãn.
    centroids = {"Người nói 1": unit(1, 0.05, 0), "Người nói 2": unit(1, 0.3, 0)}
    profiles = [{"userId": "nam", "embedding": unit(1, 0, 0).tolist()}]
    m = voice.match(centroids, profiles, threshold=0.5)
    assert list(m) == ["Người nói 1"]


def test_duoi_nguong_thi_khong_ghep():
    centroids = {"Người nói 1": unit(1, 0, 0)}
    profiles = [{"userId": "lan", "embedding": unit(0, 1, 0).tolist()}]
    assert voice.match(centroids, profiles, threshold=0.5) == {}


def test_bo_qua_van_giong_khac_kich_thuoc():
    centroids = {"Người nói 1": unit(1, 0, 0)}
    profiles = [{"userId": "lan", "embedding": [1.0, 0.0]}]
    assert voice.match(centroids, profiles, threshold=0.1) == {}


def test_mau_qua_ngan_bi_tu_choi():
    # 1 giây tiếng ồn nhỏ: không đủ 3 giây giọng nói.
    quiet = np.random.default_rng(0).normal(0, 0.001, voice.SAMPLE_RATE).astype(np.float32)
    with pytest.raises(ValueError, match="giây giọng nói"):
        voice.enroll([quiet])


def test_bo_khoang_lang():
    silence = np.zeros(voice.SAMPLE_RATE, dtype=np.float32)
    tone = 0.3 * np.sin(np.linspace(0, 2000 * np.pi, voice.SAMPLE_RATE)).astype(np.float32)
    kept = voice.voiced(np.concatenate([silence, tone, silence]))
    assert abs(len(kept) / voice.SAMPLE_RATE - 1.0) < 0.05
