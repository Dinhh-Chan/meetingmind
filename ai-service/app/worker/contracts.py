"""Hợp đồng sự kiện — bản Python của contracts/events.json.

Sửa ở đây thì phải sửa cả contracts/events.json và bản TypeScript trong
core-service/src/modules/messaging/common/constant.ts.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any

EXCHANGE = "meetingmind"
AI_JOBS_QUEUE = "ai.jobs"

TRANSCRIPTION_REQUESTED = "transcription.requested"
TRANSCRIPTION_COMPLETED = "transcription.completed"
TRANSCRIPTION_FAILED = "transcription.failed"
ANALYSIS_REQUESTED = "analysis.requested"
ANALYSIS_COMPLETED = "analysis.completed"
ANALYSIS_FAILED = "analysis.failed"

RABBITMQ_URL = os.environ.get(
    "MICROSERVICE_RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672"
)


def envelope(
    event_type: str,
    workspace_id: str,
    correlation_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Phần đầu chung của mọi sự kiện."""
    return {
        "eventId": str(uuid.uuid4()),
        "eventType": event_type,
        "eventVersion": 1,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "workspaceId": workspace_id,
        "correlationId": correlation_id,
        "payload": payload,
    }
