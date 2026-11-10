"""Phiên âm trực tiếp từng câu: model riêng, bỏ câu bịa của Whisper."""

from types import SimpleNamespace

from app.worker import live_transcribe


class FakeModel:
    def __init__(self, texts):
        self.texts = texts
        self.calls = []

    def transcribe(self, audio, **kw):
        self.calls.append(kw)
        return [SimpleNamespace(text=t) for t in self.texts], SimpleNamespace(language="vi")


def test_ghep_chu_va_bo_cau_bia(monkeypatch):
    model = FakeModel([" Chào cả nhóm ", "Hãy đăng ký kênh để không bỏ lỡ video mới nhất", " hôm nay họp nhé"])
    monkeypatch.setattr(live_transcribe, "_load_model", lambda s: model)
    text, lang = live_transcribe.transcribe([0.0] * 16000, "vi")
    assert text.startswith("Chào cả nhóm")
    assert "đăng ký kênh" not in text
    assert lang == "vi"
    assert model.calls[0]["beam_size"] == 1 and model.calls[0]["language"] == "vi"


def test_model_rieng_theo_bien_moi_truong(monkeypatch):
    monkeypatch.setenv("AI_WHISPER_MODEL", "large-v3-turbo")
    monkeypatch.setenv("AI_LIVE_WHISPER_MODEL", "small")
    assert live_transcribe.settings().model == "small"
    monkeypatch.delenv("AI_LIVE_WHISPER_MODEL")
    assert live_transcribe.settings().model == "large-v3-turbo"
