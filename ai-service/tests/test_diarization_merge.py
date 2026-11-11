"""Ghép lời Whisper (theo từ) với lượt nói của diarizer."""

from types import SimpleNamespace

import numpy as np

import numpy as np

from app.worker.diarizer import (
    Turn,
    Word,
    Window,
    build_segments,
    cluster,
    cluster_reliable,
    merge_small_clusters,
    make_windows,
    overlap_regions,
    overlap_windows,
    speaker_of,
    turns_from_windows,
)
from app.worker.whisper_transcriber import SAMPLE_RATE, Settings, WhisperTranscriber, is_hallucination


def words(*items, segment=0, language="vi"):
    return [Word(a, b, f" {t}", language, segment) for a, b, t in items]


def test_overlap_regions():
    turns = [Turn(0, 5, 0), Turn(4, 8, 1), Turn(10, 12, 0)]
    assert overlap_regions(turns) == [(4, 5)]
    assert overlap_regions([Turn(0, 2, 0), Turn(3, 4, 1)]) == []


def test_mot_doan_whisper_trum_hai_nguoi_bi_cat_doi():
    turns = [Turn(0.0, 2.0, 7), Turn(2.1, 4.0, 3)]
    ws = words((0.1, 0.5, "chốt"), (0.6, 1.8, "nhé"), (2.2, 2.6, "ok"), (2.7, 3.5, "anh"))
    segs = build_segments(ws, turns, {0: 0.9})
    assert [(s["speakerLabel"], s["text"]) for s in segs] == [("Người nói 1", "chốt nhé"), ("Người nói 2", "ok anh")]
    assert segs[1]["startMs"] == 2200 and segs[0]["confidence"] == 0.9


def test_nhan_theo_thu_tu_xuat_hien_khong_theo_id_mo_hinh():
    turns = [Turn(0, 1, 5), Turn(1.2, 2, 2), Turn(2.2, 3, 5)]
    ws = words((0.2, 0.8, "a")) + words((1.3, 1.8, "b"), segment=1) + words((2.3, 2.8, "c"), segment=2)
    assert [s["speakerLabel"] for s in build_segments(ws, turns, {})] == ["Người nói 1", "Người nói 2", "Người nói 1"]


def test_danh_dau_noi_chong():
    turns = [Turn(0, 4, 0), Turn(3, 6, 1)]
    ws = words((0.2, 2.0, "một")) + words((3.1, 3.9, "hai"), segment=1) + words((4.5, 5.5, "ba"), segment=2)
    segs = build_segments(ws, turns, {})
    assert [s["isOverlapping"] for s in segs] == [False, True, False]


def test_tu_roi_vao_khe_hop_theo_luot_gan_nhat_hoac_tu_truoc():
    turns = [Turn(0, 1, 0), Turn(5, 6, 1)]
    assert speaker_of(Word(1.2, 1.4, "x", "vi", 0), turns, None) == 0
    assert speaker_of(Word(3.0, 3.2, "y", "vi", 0), turns, 1) == 1


def test_doi_ngon_ngu_cung_nguoi_noi_tach_doan():
    turns = [Turn(0, 10, 0)]
    ws = words((0.5, 1.0, "chào")) + words((2.0, 2.5, "hello"), segment=1, language="en")
    segs = build_segments(ws, turns, {})
    assert [(s["language"], s["speakerLabel"]) for s in segs] == [("vi", "Người nói 1"), ("en", "Người nói 1")]


def test_cau_bia_quen_thuoc():
    assert is_hallucination("Hãy đăng ký kênh để không bỏ lỡ video mới")
    assert is_hallucination("Cảm ơn các bạn đã theo dõi")
    assert not is_hallucination("Cảm ơn mọi người, buổi họp kết thúc")


class FakeDiarizer:
    def turns(self, audio, words, sample_rate):
        return [Turn(0, 4, 0), Turn(4, 8, 1)]


class FakeModel:
    def detect_language(self, audio):
        return "vi", 0.99, []

    def transcribe(self, audio, language=None, **kw):
        w = lambda a, b, t: SimpleNamespace(start=a, end=b, word=t)
        segs = [
            SimpleNamespace(start=0.5, end=7.5, text=" chốt nhé ok anh", avg_logprob=-0.1,
                            words=[w(0.5, 1.5, " chốt"), w(1.6, 3.5, " nhé"), w(4.2, 5.0, " ok"), w(5.1, 7.5, " anh")]),
            SimpleNamespace(start=7.6, end=7.9, text=" Hãy đăng ký kênh", avg_logprob=-0.5, words=[]),
        ]
        return iter(segs), SimpleNamespace(language="vi")


def test_transcriber_ghep_tach_nguoi_noi_va_bo_cau_bia():
    audio = np.zeros(8 * SAMPLE_RATE, dtype=np.float32)
    result = WhisperTranscriber(Settings(), model=FakeModel(), diarizer=FakeDiarizer()).transcribe_audio(audio, "vi")
    assert [(s["speakerLabel"], s["text"]) for s in result.segments] == [
        ("Người nói 1", "chốt nhé"),
        ("Người nói 2", "ok anh"),
    ]
    assert result.model.endswith("+sherpa-onnx")


def test_cat_khuc_theo_do_dai_khoang_lang_va_doan_whisper():
    ws = words((0.0, 0.5, "a"), (0.6, 1.2, "b"), (1.3, 1.8, "c"), (3.0, 3.5, "d")) + words((3.6, 4.0, "e"), segment=1)
    assert make_windows(ws) == [Window(0.0, 1.8), Window(3.0, 3.5), Window(3.6, 4.0)]


def _voice(seed, n):
    rng = np.random.default_rng(seed)
    base = rng.standard_normal(64)
    return [base + 0.3 * rng.standard_normal(64) for _ in range(n)]


def test_gop_cum_tu_suy_ra_so_nguoi():
    a, b, c = _voice(1, 4), _voice(2, 3), _voice(3, 2)
    emb = [a[0], b[0], a[1], c[0], b[1], a[2], c[1], b[2], a[3]]
    assert cluster(emb, threshold=0.5) == [0, 1, 0, 2, 1, 0, 2, 1, 0]


def test_khuc_tron_hai_giong_la_noi_chong():
    a, b = _voice(1, 5), _voice(2, 5)
    mixed = (a[0] + b[0]) / 2
    emb = a + b + [mixed]
    labels = cluster(emb[:10], threshold=0.5)
    labels.append(labels[0])
    flags = overlap_windows(emb, labels)
    assert flags[-1] and not any(flags[:10])


def test_qua_it_khuc_thi_khong_doan_noi_chong():
    a, b = _voice(1, 2), _voice(2, 2)
    assert overlap_windows(a + b, [0, 0, 1, 1]) == [False] * 4


def test_luot_noi_chong_sinh_vung_chong():
    turns = turns_from_windows([Window(0, 1), Window(1, 2)], [0, 1], [False, True])
    assert overlap_regions(turns) == [(1, 2)]


def test_khuc_ngan_khong_tu_thanh_nguoi_noi_rieng():
    # Vài tiếng "alo" ngắn của B giống nhau (cùng lệch kiểu) hơn giống phần B nói dài.
    rng = np.random.default_rng(5)
    a, b = _voice(1, 4), _voice(2, 4)
    shift = 2.0 * rng.standard_normal(64)
    short_b = [b[0] + shift + 0.3 * rng.standard_normal(64) for _ in range(3)]
    emb = a[:2] + short_b + b + a[2:]
    durations = [1.5, 1.5, 0.4, 0.6, 0.8] + [1.5] * 6
    assert len(set(cluster(emb, threshold=0.5))) == 3
    assert cluster_reliable(emb, durations, threshold=0.5, min_window_s=1.0) == [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0]


def test_qua_it_khuc_dai_thi_gop_cum_ca():
    a, b = _voice(1, 2), _voice(2, 2)
    emb = a + b
    assert cluster_reliable(emb, [0.5, 1.5, 0.5, 0.5], threshold=0.5, min_window_s=1.0) == cluster(emb, threshold=0.5)


def test_cum_qua_nho_gop_vao_nguoi_giong_nhat():
    a, b = _voice(1, 4), _voice(2, 4)
    noisy_a = a[0] + 0.8 * np.random.default_rng(9).standard_normal(64)
    emb = a + b + [noisy_a]
    labels = [0, 0, 0, 0, 1, 1, 1, 1, 2]
    durations = [1.5] * 8 + [0.6]
    assert merge_small_clusters(emb, labels, durations, min_speaker_s=2.0) == [0, 0, 0, 0, 1, 1, 1, 1, 0]


def test_doan_ra_chuyen_duoc_json_khi_moc_la_numpy():
    import json

    turns = [Turn(np.float64(0), np.float64(4), 0), Turn(np.float64(3), np.float64(6), 1)]
    ws = [Word(np.float64(3.1), np.float64(3.9), " hai", "vi", 0)]
    segs = build_segments(ws, turns, {0: None})
    json.dumps(segs)
    assert segs[0]["isOverlapping"] is True
