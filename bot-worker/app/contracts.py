"""Hợp đồng sự kiện — bản Python cho bot-worker của contracts/events.json.

Sửa ở đây thì phải sửa cả contracts/events.json và
core-service/src/modules/messaging/common/constant.ts.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any

EXCHANGE = "meetingmind"
# Lệnh vào phòng chạy hàng giờ; lệnh dừng đi queue riêng để không phải xếp hàng sau.
BOT_JOBS_QUEUE = "bot.jobs"
BOT_CONTROL_QUEUE = "bot.control"

BOT_JOIN_REQUESTED = "bot.join.requested"
BOT_STOP_REQUESTED = "bot.stop.requested"
BOT_STATUS_CHANGED = "bot.status.changed"
RECORDING_COMPLETED = "recording.completed"

RABBITMQ_URL = os.environ.get("MICROSERVICE_RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672")


def envelope(event_type: str, workspace_id: str, correlation_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "eventId": str(uuid.uuid4()),
        "eventType": event_type,
        "eventVersion": 1,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "workspaceId": workspace_id,
        "correlationId": correlation_id,
        "payload": payload,
    }
