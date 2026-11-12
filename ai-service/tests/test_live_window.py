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
