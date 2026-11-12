"""Đăng ký giọng nói: Core gửi vài mẫu đọc, nhận lại vân giọng để lưu.

Route nội bộ, xác thực bằng X-Internal-Token như hỏi đáp tri thức. Âm thanh
mẫu chỉ được giải mã trong bộ nhớ và tệp tạm; Core tự giữ bản gốc để admin
nghe khi xác nhận.
"""

import base64
import binascii
import os
import tempfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.api_knowledge import require_internal_token
from app.worker import voice

# Một mẫu đọc ~10 giây webm/opus chỉ vài trăm KB; chặn tệp bất thường.
MAX_SAMPLE_BYTES = 8 * 1024 * 1024

router = APIRouter(
    prefix="/internal/voice",
    tags=["Internal - Voice"],
    dependencies=[Depends(require_internal_token)],
)


class EmbeddingRequest(BaseModel):
    # Mỗi phần tử: một mẫu ghi âm (webm, ogg, wav, mp3…) mã hoá base64.
    samples: List[str] = Field(min_length=1, max_length=voice.MAX_SAMPLES)


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    seconds: float
    model: str
    # good | short | noisy
    quality: str


class UtteranceRequest(BaseModel):
    # Một câu ghi trực tiếp (wav 16 kHz từ trình duyệt) mã hoá base64.
    audio: str


class LiveUtteranceRequest(BaseModel):
    audio: str
    language: str | None = "vi"


class LiveUtteranceResponse(BaseModel):
    text: str
    language: str | None
    # Trống khi câu quá ít giọng nói để nhận người.
    embedding: List[float] | None
    seconds: float


class LiveSegment(BaseModel):
    # Giây, tính từ đầu đoạn âm thanh gửi lên.
    start: float
    end: float
    text: str


class LiveWindowResponse(BaseModel):
    segments: List[LiveSegment]
    seconds: float


class UtteranceResponse(BaseModel):
    # Trống khi câu quá ít giọng nói để nhận người.
    embedding: List[float] | None
    seconds: float


def _decode(sample: str):
    from faster_whisper import decode_audio

    try:
        raw = base64.b64decode(sample, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Mẫu giọng không đúng định dạng base64")
    if len(raw) > MAX_SAMPLE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Mẫu giọng quá lớn")
    fd, path = tempfile.mkstemp(suffix=".audio")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
        return decode_audio(path, voice.SAMPLE_RATE)
    except Exception:  # noqa: BLE001 - tệp hỏng hoặc không phải âm thanh
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Không đọc được âm thanh của mẫu giọng")
    finally:
        os.unlink(path)


@router.post("/embedding", response_model=EmbeddingResponse)
def embedding(body: EmbeddingRequest) -> EmbeddingResponse:
    samples = [_decode(s) for s in body.samples]
    try:
        vector, seconds, rating = voice.enroll(samples)
    except ValueError as err:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(err))
    return EmbeddingResponse(embedding=vector, seconds=seconds, model=voice.MODEL, quality=rating)


@router.post("/utterance", response_model=UtteranceResponse)
def utterance(body: UtteranceRequest) -> UtteranceResponse:
    """Vân giọng của một câu trong lúc ghi trực tiếp, để giao diện gộp câu theo người nói."""
    result = voice.embed_utterance(_decode(body.audio))
    if result is None:
        return UtteranceResponse(embedding=None, seconds=0.0)
    vector, seconds = result
    return UtteranceResponse(embedding=vector, seconds=seconds)


@router.post("/live-utterance", response_model=LiveUtteranceResponse)
def live_utterance(body: LiveUtteranceRequest) -> LiveUtteranceResponse:
    """Một câu ghi trực tiếp: chép lời (Whisper) và vân giọng để nhận người nói."""
    from app.worker import live_transcribe

    audio = _decode(body.audio)
    text, language = live_transcribe.transcribe(audio, body.language)
    result = voice.embed_utterance(audio) if text else None
    vector, seconds = result if result else (None, 0.0)
    return LiveUtteranceResponse(text=text, language=language, embedding=vector, seconds=seconds)


@router.post("/live-window", response_model=LiveWindowResponse)
def live_window(body: LiveUtteranceRequest) -> LiveWindowResponse:
    """Phiên âm trực tiếp kiểu cửa sổ trượt: chép lời phần âm thanh chưa chốt, trả các câu kèm mốc."""
    from app.worker import live_transcribe

    audio = _decode(body.audio)
    segments = live_transcribe.transcribe_window(audio, body.language)
    return LiveWindowResponse(
        segments=[LiveSegment(start=a, end=b, text=text) for a, b, text in segments],
        seconds=round(len(audio) / voice.SAMPLE_RATE, 2),
    )
