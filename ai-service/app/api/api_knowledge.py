"""API nội bộ hỏi đáp tri thức cuộc họp, chỉ Core gọi trong mạng Docker.

Không dùng đăng nhập người dùng của template (JWT): Core đã xác thực người
hỏi và tính sẵn meetingIds họ được xem; ở đây chỉ kiểm tra Core bằng
X-Internal-Token. Router gắn thẳng vào app, ngoài tiền tố /api.

Hội thoại thuộc (workspaceId, userId) Core gửi; hội thoại của người khác trả
404 y như không tồn tại.
"""

import asyncio
import hmac
import logging
import os
from typing import Any, Callable, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.schemas.sche_knowledge import (
    AskRequest,
    AskResponse,
    DeleteThreadResponse,
    RenameThreadRequest,
    RenameThreadResponse,
    SourcesRequest,
    SourceSummary,
    ThreadDetail,
    ThreadOwner,
    ThreadRef,
    ThreadSummary,
)
from app.worker.knowledge_qa import KnowledgeError, KnowledgeQA
from app.worker.knowledge_threads import ThreadNotFound, ThreadStore, message_view, thread_summary

log = logging.getLogger("app.knowledge")

STORE_UNAVAILABLE = "Kho tri thức tạm thời không truy cập được"
THREAD_NOT_FOUND = "Không tìm thấy hội thoại"


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


def get_threads() -> ThreadStore:
    return ThreadStore()


def get_qa(threads: ThreadStore = Depends(get_threads)) -> KnowledgeQA:
    return KnowledgeQA(threads=threads)


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, THREAD_NOT_FOUND)


async def _db(call: Callable[..., Any], *args: Any) -> Any:
    """Chạy thao tác database đồng bộ ngoài vòng sự kiện; database hỏng thì 503."""
    try:
        return await asyncio.to_thread(call, *args)
    except Exception:  # noqa: BLE001
        log.exception("Truy cập lịch sử hỏi đáp lỗi")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, STORE_UNAVAILABLE) from None


@router.post("/ask", response_model=AskResponse, response_model_exclude_none=True)
async def ask(body: AskRequest, qa: KnowledgeQA = Depends(get_qa)) -> dict:
    # body.history cố ý bỏ qua: ngữ cảnh lấy từ DB theo threadId.
    try:
        return await qa.chat(
            workspace_id=body.workspaceId,
            user_id=body.userId,
            question=body.question,
            meeting_ids=body.meetingIds,
            thread_id=body.threadId,
        )
    except ThreadNotFound:
        raise _not_found() from None
    except KnowledgeError as err:
        log.warning("Hỏi đáp lỗi: %s", err)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Dịch vụ AI tạm thời không trả lời được") from None
    except Exception:  # noqa: BLE001 - database hỏng: báo rõ là tạm thời
        log.exception("Hỏi đáp lỗi")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, STORE_UNAVAILABLE) from None


@router.post("/sources", response_model=List[SourceSummary], response_model_exclude_none=True)
async def sources(body: SourcesRequest, qa: KnowledgeQA = Depends(get_qa)) -> list:
    try:
        return await qa.sources(body.workspaceId, body.meetingIds)
    except Exception:  # noqa: BLE001
        log.exception("Liệt kê nguồn lỗi")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, STORE_UNAVAILABLE) from None


@router.post("/threads/list", response_model=List[ThreadSummary], response_model_exclude_none=True)
async def list_threads(body: ThreadOwner, threads: ThreadStore = Depends(get_threads)) -> list:
    rows = await _db(threads.list_threads, body.workspaceId, body.userId)
    return [thread_summary(r) for r in rows]


@router.post("/threads/get", response_model=ThreadDetail, response_model_exclude_none=True)
async def get_thread(body: ThreadRef, threads: ThreadStore = Depends(get_threads)) -> dict:
    thread = await _db(threads.find, body.workspaceId, body.userId, body.threadId)
    if thread is None:
        raise _not_found()
    # Đã kiểm chủ ở trên; câu đọc tin vẫn lọc workspace để phòng id trùng.
    messages = await _db(threads.thread_messages, body.workspaceId, body.threadId)
    return {"threadId": thread["id"], "title": thread.get("title"), "messages": [message_view(m) for m in messages]}


@router.post("/threads/rename", response_model=RenameThreadResponse)
async def rename_thread(body: RenameThreadRequest, threads: ThreadStore = Depends(get_threads)) -> dict:
    row = await _db(threads.rename, body.workspaceId, body.userId, body.threadId, body.title)
    if row is None:
        raise _not_found()
    return {"threadId": row["id"], "title": row["title"]}


@router.post("/threads/delete", response_model=DeleteThreadResponse)
async def delete_thread(body: ThreadRef, threads: ThreadStore = Depends(get_threads)) -> dict:
    if not await _db(threads.delete, body.workspaceId, body.userId, body.threadId):
        raise _not_found()
    return {"deleted": True}
