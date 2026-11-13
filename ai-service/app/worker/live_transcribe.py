"""Phiên âm trực tiếp khi ghi âm trên trình duyệt.

Hai cách:
- transcribe_window (đang dùng): vài giây một lần trình duyệt gửi phần âm thanh
  chưa chốt (tối đa ~28 s); ở đây chép lời như bản chính thức (lọc tiếng nói
  bằng Silero, xem speech_regions.py) và trả các câu kèm mốc. Trình duyệt chốt
  câu đã nói xong, câu đang nói hiện dần.
- transcribe (cũ): trình duyệt tự cắt câu theo năng lượng rồi gửi từng câu.
  Đo trên video cuộc họp thật: cắt theo năng lượng làm mất hơn nửa lời (đúng
  4/20 cụm từ kiểm tra so với 12/20 của cửa sổ trượt và của bản chính thức).

Không tách người nói ở đây: nhận người bằng vân giọng từng câu (voice.py). Bản
chính thức vẫn phiên âm lại cả bản ghi sau khi kết thúc.
"""

from __future__ import annotations

import os
import threading

from app.worker import refine
from app.worker.speech_regions import speech_filter
from app.worker.whisper_transcriber import SAMPLE_RATE, Settings, _load_model, is_hallucination

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


def transcribe_window(audio, language: str | None = "vi") -> list[tuple[float, float, str]]:
    """Các câu (bắt đầu, kết thúc, chữ) trong một cửa sổ âm thanh, đã bỏ câu bịa."""
    s = settings()
    beam = int(os.environ.get("AI_LIVE_WINDOW_BEAM_SIZE", "5"))
    # Cùng lượt sửa từ tiếng Việt như bản chính thức, để chữ lúc ghi và sau khi xử lý khớp nhau.
    polish = refine.enabled() and (language or "vi") == "vi"
    with _lock:
        model = _load_model(s)
        segments, _ = model.transcribe(
            audio,
            language=language or None,
            beam_size=beam,
            condition_on_previous_text=False,
            # Lượt sửa cần mốc và độ tự tin từng từ.
            word_timestamps=polish,
            **speech_filter(audio),
        )
        found = [
            (round(float(seg.start), 2), round(float(seg.end), 2), seg.text.strip(), list(seg.words or []) if polish else [])
            for seg in segments
        ]
    out: list[tuple[float, float, str]] = []
    pad = int(0.15 * SAMPLE_RATE)
    for start, end, text, words in found:
        if not text or is_hallucination(text):
            continue
        if words:
            a0 = max(0, int(start * SAMPLE_RATE) - pad)
            merged = refine.refine_words(
                audio[a0 : int(end * SAMPLE_RATE) + pad],
                a0 / SAMPLE_RATE,
                [(float(w.start), float(w.end), w.word) for w in words],
                s.device,
                s.compute_type,
                [float(getattr(w, "probability", 1.0)) for w in words],
            )
            text = "".join(t for _, _, t in merged).strip() or text
        out.append((start, end, text))
    return out
