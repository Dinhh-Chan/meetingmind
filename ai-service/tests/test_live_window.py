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
