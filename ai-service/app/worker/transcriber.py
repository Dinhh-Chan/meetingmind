"""Phiên âm. Bản stub để thông luồng; bản Whisper dùng khi bật AI_STT=whisper."""

import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

log = logging.getLogger("ai-worker")


@dataclass
class TranscriptResult:
    run_id: str
    model: str
    segments: list[dict[str, Any]] = field(default_factory=list)


class Transcriber(Protocol):
    async def transcribe(
        self, bucket: str, object_key: str, language: str
    ) -> TranscriptResult: ...


class StubTranscriber:
    """Trả transcript cố định để kiểm chứng đường đi của luồng.

    Dùng câu ví dụ trong tài liệu nghiệp vụ mục 7 vì nó chứa đủ thứ cần kiểm
    tra sau đó: một người giao việc, một người nhận, một hạn mơ hồ và một
    người liên quan không rõ trách nhiệm.
    """

    async def transcribe(
        self, bucket: str, object_key: str, language: str
    ) -> TranscriptResult:
        log.warning(
            "Đang dùng StubTranscriber (AI_STT chưa bật). object=%s/%s",
            bucket,
            object_key,
        )
        return TranscriptResult(
            run_id=str(uuid.uuid4()),
            model="stub",
            segments=[
                {
                    "speakerLabel": "Speaker 1",
                    "startMs": 0,
                    "endMs": 6000,
                    "text": "Chào mọi người, hôm nay mình chốt phần đăng nhập.",
                    "confidence": 0.95,
                },
                {
                    "speakerLabel": "Speaker 1",
                    "startMs": 755000,
                    "endMs": 762000,
                    "text": "Nam phụ trách API đăng nhập, thứ Sáu gửi bản đầu tiên để Lan kiểm thử.",
                    "confidence": 0.92,
                },
                {
                    "speakerLabel": "Speaker 2",
                    "startMs": 762000,
                    "endMs": 770000,
                    "text": "Hay là mình dùng luôn JWT cho gọn, chưa cần session.",
                    "confidence": 0.9,
                },
            ],
        )


def get_transcriber() -> Transcriber:
    engine = os.environ.get("AI_STT", "stub").lower()
    if engine == "whisper":
        from app.worker.whisper_transcriber import WhisperTranscriber

        return WhisperTranscriber()
    return StubTranscriber()
