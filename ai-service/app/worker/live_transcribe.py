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


# Trùng quy tắc chốt câu của trình duyệt (commitWindow trong live-speaker.ts): câu
# kết thúc trước cuối cửa sổ ít nhất GUARD giây là đã nói xong; cửa sổ dài tối đa
# mà chưa chốt được gì thì chốt hết trừ câu cuối.
COMMIT_GUARD_S = 1.0
MAX_WINDOW_S = 28.0


def will_commit(segments: list[tuple[float, float, str]], window_s: float) -> list[bool]:
    """Câu nào trình duyệt sẽ chốt từ lần trả lời này."""
    final = [b <= window_s - COMMIT_GUARD_S for _, b, _ in segments]
    if not any(final) and segments and window_s >= MAX_WINDOW_S - 0.1:
        final = [i < len(segments) - 1 for i in range(len(segments))] if len(segments) > 1 else [True]
    return final


def transcribe_window(audio, language: str | None = "vi") -> list[tuple[float, float, str]]:
    """Các câu (bắt đầu, kết thúc, chữ) trong một cửa sổ âm thanh, đã bỏ câu bịa.

    Lượt sửa từ tiếng Việt chỉ chạy cho câu sắp được chốt: câu đang nói dở còn
    được gửi lại ở lần sau, sửa nó mỗi lần làm một cửa sổ 28 s mất 5–7 s thay vì
    dưới 1 s. Câu đã chốt không được gửi lại nên mỗi câu chỉ sửa một lần.
    """
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
    found = [x for x in found if x[2] and not is_hallucination(x[2])]
    final = will_commit([(a, b, t) for a, b, t, _ in found], len(audio) / SAMPLE_RATE)
    out: list[tuple[float, float, str]] = []
    pad = int(0.15 * SAMPLE_RATE)
    for (start, end, text, words), done in zip(found, final):
        if words and done:
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
