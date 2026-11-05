"""Lập chỉ mục tri thức cuộc họp: cắt đoạn → nhúng vector → thay bản cũ trong ai.document_chunks.

Core gửi knowledge.index.requested mỗi khi một nguồn đổi (transcript bản mới,
biên bản được sửa, quyết định/công việc được duyệt, tài liệu tải lên). Nhúng
xong hết mới mở transaction thay dữ liệu, để lỗi gọi API nhúng không làm mất
bản cũ và transaction không bị giữ lâu.
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

from app.worker import knowledge_store as store
from app.worker.document_text import extract_text
from app.worker.embeddings import EmbeddingClient
from app.worker.knowledge_chunker import (
    SOURCE_LABELS,
    SOURCE_TYPES,
    Chunk,
    chunk_document,
    chunk_header,
    chunk_items,
    chunk_transcript,
    embed_text,
)
from app.worker.storage import download_to_temp

log = logging.getLogger("app.knowledge")

# Chặn trên số đoạn mỗi nguồn: tài liệu vài trăm trang sẽ tốn hàng trăm lượt
# gọi API nhúng mà hiếm khi hỏi tới phần đuôi.
MAX_CHUNKS = int(os.environ.get("AI_KNOWLEDGE_MAX_CHUNKS", "2000"))


@dataclass
class IndexResult:
    chunks: int
    deleted: int


def _text(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def source_title(source_type: str, items: list[dict[str, Any]], document: dict[str, Any] | None) -> str:
    """Tên hiển thị của nguồn trong danh sách nguồn đã lập chỉ mục."""
    if source_type == "document":
        return _text((document or {}).get("fileName")) or SOURCE_LABELS["document"]
    if source_type in ("decision", "action_item"):
        for item in items:
            if _text(item.get("title")):
                return _text(item["title"])
    return SOURCE_LABELS.get(source_type, source_type)


async def build_chunks(source_type: str, items: list[dict[str, Any]], document: dict[str, Any] | None) -> list[Chunk]:
    if source_type == "transcript":
        return chunk_transcript(items)
    if source_type != "document":
        return chunk_items(items)
    if not document or not document.get("bucket") or not document.get("objectKey"):
        raise ValueError("sourceType=document nhưng thiếu document.bucket/objectKey")
    path = await asyncio.to_thread(download_to_temp, document["bucket"], document["objectKey"])
    try:
        text = await asyncio.to_thread(extract_text, path, document.get("fileName") or "", document.get("mimetype"))
    finally:
        path.unlink(missing_ok=True)
    chunks = chunk_document(text)
    if not chunks:
        log.warning("Tài liệu %s không có chữ (có thể là bản scan)", document.get("fileName"))
    for chunk in chunks:
        chunk.metadata.update({"fileName": document.get("fileName"), "mimetype": document.get("mimetype")})
    return chunks


async def index_source(workspace_id: str, payload: dict[str, Any], embedder: EmbeddingClient | None = None) -> IndexResult:
    meeting_id = _text(payload.get("meetingId"))
    source_type = _text(payload.get("sourceType"))
    source_id = _text(payload.get("sourceId"))
    if not workspace_id or not meeting_id or not source_id:
        raise ValueError("thiếu workspaceId, meetingId hoặc sourceId")
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"sourceType không hợp lệ: {source_type}")
    meeting_title = _text(payload.get("meetingTitle")) or "Cuộc họp không tên"
    items = [i for i in payload.get("items") or [] if isinstance(i, dict)]
    document = payload.get("document") if isinstance(payload.get("document"), dict) else None

    chunks = await build_chunks(source_type, items, document)
    if len(chunks) > MAX_CHUNKS:
        log.warning("Nguồn %s/%s có %d đoạn, chỉ giữ %d", source_type, source_id, len(chunks), MAX_CHUNKS)
        chunks = chunks[:MAX_CHUNKS]

    title = source_title(source_type, items, document)
    common = {"sourceTitle": title}
    if _text(payload.get("meetingDate")):
        common["meetingDate"] = _text(payload.get("meetingDate"))
    texts = []
    for chunk in chunks:
        chunk.metadata = {**common, **chunk.metadata}
        # Đầu mục dùng tiêu đề riêng của mục (quyết định, công việc) nếu có.
        header_title = chunk.metadata.get("title") or (title if source_type == "document" else None)
        texts.append(embed_text(chunk_header(meeting_title, source_type, header_title), chunk.content))

    # Nguồn rỗng (vd. transcript bản mới không còn lời nào) vẫn đi tiếp để xoá bản cũ.
    embedder = embedder or EmbeddingClient()
    vectors = await embedder.embed(texts)

    deleted, inserted = await asyncio.to_thread(
        store.replace_source,
        workspace_id=workspace_id,
        project_id=_text(payload.get("projectId")),
        meeting_id=meeting_id,
        meeting_title=meeting_title,
        source_type=source_type,
        source_id=source_id,
        source_version=_text(payload.get("sourceVersion")),
        embedding_model=embedder.model,
        chunks=[
            {
                "content": c.content,
                "start_ms": c.start_ms,
                "end_ms": c.end_ms,
                "metadata": c.metadata,
                "embedding": v,
            }
            for c, v in zip(chunks, vectors)
        ],
    )
    return IndexResult(chunks=inserted, deleted=deleted)


async def delete_source(workspace_id: str, payload: dict[str, Any]) -> int:
    return await asyncio.to_thread(
        store.delete_chunks,
        workspace_id,
        _text(payload.get("meetingId")),
        _text(payload.get("sourceType")),
        _text(payload.get("sourceId")),
    )
