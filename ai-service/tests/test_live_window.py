"""Phiên âm trực tiếp kiểu cửa sổ trượt: trả câu kèm mốc, bỏ câu bịa."""

from types import SimpleNamespace

import numpy as np

from app.worker import live_transcribe


class FakeModel:
    def __init__(self):
        self.calls = []

    def transcribe(self, audio, **kw):
        self.calls.append(kw)
        segs = [
            SimpleNamespace(start=0.5, end=3.2, text=" Chào mọi người"),
            SimpleNamespace(start=3.4, end=4.0, text=" Hãy đăng ký kênh"),
            SimpleNamespace(start=4.1, end=4.3, text="  "),
            SimpleNamespace(start=5.0, end=9.25, text=" mình bắt đầu họp nhé"),
        ]
        return iter(segs), SimpleNamespace(language="vi")


def test_cua_so_tra_cau_kem_moc_va_bo_cau_bia(monkeypatch):
    model = FakeModel()
    monkeypatch.setattr(live_transcribe, "_load_model", lambda s: model)
    monkeypatch.setattr(live_transcribe, "speech_filter", lambda audio: {"vad_filter": True})
    out = live_transcribe.transcribe_window(np.zeros(16000 * 10, dtype=np.float32), "vi")
    assert out == [(0.5, 3.2, "Chào mọi người"), (5.0, 9.25, "mình bắt đầu họp nhé")]
    assert model.calls[0]["vad_filter"] is True and model.calls[0]["language"] == "vi"
    assert model.calls[0]["condition_on_previous_text"] is False


def test_cua_so_qua_luot_sua_tu_tieng_viet_khi_bat(monkeypatch):
    w = lambda a, b, t, p: SimpleNamespace(start=a, end=b, word=t, probability=p)

    class WordModel(FakeModel):
        def transcribe(self, audio, **kw):
            self.calls.append(kw)
            seg = SimpleNamespace(start=0.5, end=2.0, text=" phiên năng.", words=[w(0.5, 1.0, " phiên", 0.9), w(1.0, 2.0, " năng.", 0.4)])
            return iter([seg]), SimpleNamespace(language="vi")

    seen = {}

    def fake_refine(clip, offset, base, device, compute_type, probs):
        seen.update(len=len(clip), offset=offset, probs=probs)
        return [base[0], (1.0, 2.0, " âm.")]

    model = WordModel()
    monkeypatch.setattr(live_transcribe, "_load_model", lambda s: model)
    monkeypatch.setattr(live_transcribe, "speech_filter", lambda audio: {"vad_filter": True})
    monkeypatch.setattr(live_transcribe.refine, "enabled", lambda: True)
    monkeypatch.setattr(live_transcribe.refine, "refine_words", fake_refine)
    out = live_transcribe.transcribe_window(np.zeros(16000 * 4, dtype=np.float32), "vi")
    assert out == [(0.5, 2.0, "phiên âm.")]
    assert model.calls[0]["word_timestamps"] is True
    # Nghe lại đúng câu đó, nới 0,15 s hai đầu, kèm độ tự tin từng từ của Whisper.
    assert seen == {"len": int(1.8 * 16000), "offset": 0.35, "probs": [0.9, 0.4]}
    # Tiếng Anh thì không qua lượt sửa.
    live_transcribe.transcribe_window(np.zeros(16000 * 4, dtype=np.float32), "en")
    assert model.calls[1]["word_timestamps"] is False


def test_cau_nao_se_duoc_chot_giong_trinh_duyet():
    segs = [(0.0, 3.0, "a"), (3.5, 8.6, "b"), (9.0, 9.8, "c")]
    # Cửa sổ 10 s: câu kết thúc trước giây thứ 9 là xong.
    assert live_transcribe.will_commit(segs, 10.0) == [True, True, False]
    # Cửa sổ 28 s mà chưa câu nào xong: chốt hết trừ câu cuối.
    assert live_transcribe.will_commit([(0.0, 27.5, "a"), (27.6, 28.0, "b")], 28.0) == [True, False]
    assert live_transcribe.will_commit([(0.0, 27.9, "a")], 28.0) == [True]
    assert live_transcribe.will_commit([], 28.0) == []


def test_cau_dang_noi_do_khong_qua_luot_sua(monkeypatch):
    w = lambda a, b, t: SimpleNamespace(start=a, end=b, word=t, probability=0.5)

    class TwoSegments(FakeModel):
        def transcribe(self, audio, **kw):
            return iter([
                SimpleNamespace(start=0.5, end=2.0, text=" xong rồi", words=[w(0.5, 1.0, " xong"), w(1.0, 2.0, " rồi")]),
                SimpleNamespace(start=2.5, end=3.8, text=" đang nói", words=[w(2.5, 3.0, " đang"), w(3.0, 3.8, " nói")]),
            ]), SimpleNamespace(language="vi")

    calls = []
    monkeypatch.setattr(live_transcribe, "_load_model", lambda s: TwoSegments())
    monkeypatch.setattr(live_transcribe, "speech_filter", lambda audio: {"vad_filter": True})
    monkeypatch.setattr(live_transcribe.refine, "enabled", lambda: True)
    monkeypatch.setattr(live_transcribe.refine, "refine_words", lambda clip, off, base, *a: calls.append(base) or base)
    out = live_transcribe.transcribe_window(np.zeros(16000 * 4, dtype=np.float32), "vi")
    assert [t for _, _, t in out] == ["xong rồi", "đang nói"]
    assert len(calls) == 1 and calls[0][0][2] == " xong"
