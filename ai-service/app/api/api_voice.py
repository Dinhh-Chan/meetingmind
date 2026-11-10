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
