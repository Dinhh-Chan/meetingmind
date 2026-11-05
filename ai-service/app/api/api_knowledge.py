"""API nội bộ hỏi đáp tri thức cuộc họp, chỉ Core gọi trong mạng Docker.

Không dùng đăng nhập người dùng của template (JWT): Core đã xác thực người
hỏi và tính sẵn meetingIds họ được xem; ở đây chỉ kiểm tra Core bằng
X-Internal-Token. Router gắn thẳng vào app, ngoài tiền tố /api.
"""

import hmac
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.schemas.sche_knowledge import AskRequest, AskResponse, SourcesRequest, SourceSummary
from app.worker.knowledge_qa import KnowledgeError, KnowledgeQA

log = logging.getLogger("app.knowledge")


def require_internal_token(x_internal_token: Optional[str] = Header(default=None)) -> None:
    # Đọc env mỗi lần gọi: đổi token chỉ cần khởi động lại, test đặt env được.
    expected = os.environ.get("AI_INTERNAL_TOKEN", "")
    if not expected:
        # Thiếu cấu hình thì đóng hẳn, không để API mở cho mọi người trong mạng.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI_INTERNAL_TOKEN chưa cấu hình")
    # So sánh thời gian hằng: không lộ token qua độ trễ phản hồi.
    if not x_internal_token or not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sai X-Internal-Token")


router = APIRouter(
    prefix="/internal/knowledge",
    tags=["Internal - Knowledge"],
    dependencies=[Depends(require_internal_token)],
)


def get_qa() -> KnowledgeQA:
    return KnowledgeQA()


@router.post("/ask", response_model=AskResponse, response_model_exclude_none=True)
async def ask(body: AskRequest, qa: KnowledgeQA = Depends(get_qa)) -> dict:
    try:
        return await qa.ask(
            workspace_id=body.workspaceId,
            question=body.question,
            meeting_ids=body.meetingIds,
            history=[turn.model_dump() for turn in body.history],
        )
    except KnowledgeError as err:
        log.warning("Hỏi đáp lỗi: %s", err)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Dịch vụ AI tạm thời không trả lời được") from None
    except Exception:  # noqa: BLE001 - database hỏng: báo rõ là tạm thời
        log.exception("Hỏi đáp lỗi")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kho tri thức tạm thời không truy cập được") from None


@router.post("/sources", response_model=List[SourceSummary], response_model_exclude_none=True)
async def sources(body: SourcesRequest, qa: KnowledgeQA = Depends(get_qa)) -> list:
    try:
        return await qa.sources(body.workspaceId, body.meetingIds)
    except Exception:  # noqa: BLE001
        log.exception("Liệt kê nguồn lỗi")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kho tri thức tạm thời không truy cập được") from None
