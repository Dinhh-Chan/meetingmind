"""Phiên âm trực tiếp từng câu khi ghi âm trên trình duyệt.

Trình duyệt tự cắt câu theo khoảng lặng rồi gửi lên; ở đây chép lời câu đó
bằng Whisper (không tách người nói — mỗi câu là một người, nhận người bằng vân
giọng ở voice.py). Bản chính thức vẫn phiên âm lại cả bản ghi sau khi kết thúc.
"""

from __future__ import annotations

import os
import threading

from app.worker.whisper_transcriber import Settings, _load_model, is_hallucination

_lock = threading.Lock()


def settings() -> Settings:
    """Model riêng cho phiên âm trực tiếp (AI_LIVE_WHISPER_*), mặc định theo AI_WHISPER_*."""
    env = os.environ.get
    base = Settings.from_env()
    return Settings(
        model=env("AI_LIVE_WHISPER_MODEL", base.model),
        device=env("AI_LIVE_WHISPER_DEVICE", base.device),
        compute_type=env("AI_LIVE_WHISPER_COMPUTE_TYPE", base.compute_type),
        # Câu ngắn, cần nhanh: tìm tham lam thay vì beam search.
        beam_size=int(env("AI_LIVE_WHISPER_BEAM_SIZE", "1")),
    )


def transcribe(audio, language: str | None = "vi") -> tuple[str, str | None]:
    """Chữ của một câu (đã bỏ câu bịa của Whisper) và ngôn ngữ nhận ra."""
    s = settings()
    # Một model dùng chung cho mọi phiên đang ghi: chạy lần lượt cho chắc.
    with _lock:
        model = _load_model(s)
        segments, info = model.transcribe(
            audio,
            language=language or None,
            beam_size=s.beam_size,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        parts = [seg.text.strip() for seg in segments]
    text = " ".join(p for p in parts if p and not is_hallucination(p))
    return text.strip(), getattr(info, "language", language)
