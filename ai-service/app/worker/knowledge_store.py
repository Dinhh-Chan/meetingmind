"""Bảng ai.document_chunks: đoạn tri thức của cuộc họp kèm vector, cho hỏi đáp (RAG).

Dùng chung: ai-worker ghi (lập chỉ mục), API hỏi đáp đọc. psycopg2 đồng bộ,
bên gọi bất đồng bộ bọc bằng asyncio.to_thread để không chặn vòng sự kiện.
Mỗi thao tác mở một kết nối riêng: lưu lượng thấp, và không phải giữ pool
sống qua những lần Postgres khởi động lại.

Quyền xem (§6.12): Core đã tính danh sách meetingIds người hỏi được xem. Mọi
truy vấn đọc đều lọc workspace_id + meeting_id ngay trong SQL, nên đoạn của
cuộc họp ngoài quyền không bao giờ ra khỏi database, càng không tới model.
"""

import json
import logging
import os
import re
import threading
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg2
import psycopg2.extras

from app.worker.embeddings import EMBEDDING_DIM

log = logging.getLogger("app.knowledge")

SCHEMA = os.environ.get("POSTGRES_SCHEMA", "ai")
if not re.fullmatch(r"[a-z_][a-z0-9_]*", SCHEMA):
    raise ValueError(f"POSTGRES_SCHEMA không hợp lệ: {SCHEMA!r}")
TABLE = f"{SCHEMA}.document_chunks"

# Transcript và biên bản có nhiều phiên bản; chỉ bản hiện tại được tìm.
VERSIONED_SOURCES = ("transcript", "minutes")

# Khoá chung khi tạo bảng: ai-service và ai-worker khởi động cùng lúc, hai
# lệnh CREATE ... IF NOT EXISTS song song vẫn có thể đụng nhau trong catalog.
_SCHEMA_LOCK_KEY = 7_420_011

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    id              text PRIMARY KEY,
    workspace_id    text NOT NULL,
    project_id      text,
    meeting_id      text,
    meeting_title   text,
    source_type     text NOT NULL,
    source_id       text NOT NULL,
    source_version  text,
    chunk_index     integer NOT NULL,
    content         text NOT NULL,
    start_ms        bigint,
    end_ms          bigint,
    metadata        jsonb NOT NULL DEFAULT '{{}}'::jsonb,
    embedding       public.vector({EMBEDDING_DIM}),
    embedding_model text,
    index_status    text NOT NULL DEFAULT 'indexed',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_chunks_workspace_meeting_idx
    ON {TABLE} (workspace_id, meeting_id);
CREATE INDEX IF NOT EXISTS document_chunks_source_idx
    ON {TABLE} (source_type, source_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
    ON {TABLE} USING hnsw (embedding public.vector_cosine_ops);
"""

_COLUMNS = (
    "id, workspace_id, project_id, meeting_id, meeting_title, source_type, source_id, "
    "source_version, chunk_index, content, start_ms, end_ms, metadata, embedding, "
    "embedding_model, index_status"
)
_INSERT_TEMPLATE = (
    "(%(id)s, %(workspace_id)s, %(project_id)s, %(meeting_id)s, %(meeting_title)s, "
    "%(source_type)s, %(source_id)s, %(source_version)s, %(chunk_index)s, %(content)s, "
    "%(start_ms)s, %(end_ms)s, %(metadata)s::jsonb, %(embedding)s::public.vector, "
    "%(embedding_model)s, 'indexed')"
)

_ready = False
_ready_lock = threading.Lock()


def _connect():
    env = os.environ.get
    return psycopg2.connect(
        host=env("POSTGRES_HOST", "postgres"),
        port=int(env("POSTGRES_PORT", "5432")),
        dbname=env("POSTGRES_DB", "meetingmind"),
        user=env("POSTGRES_USER", "mm_ai"),
        password=env("POSTGRES_PASSWORD", ""),
        connect_timeout=10,
        options=f"-csearch_path={SCHEMA},public",
        application_name="ai-knowledge",
    )


@contextmanager
def _transaction(dict_rows: bool = False) -> Iterator[Any]:
    conn = _connect()
    try:
        with conn:  # commit khi xong, rollback khi lỗi
            factory = psycopg2.extras.RealDictCursor if dict_rows else None
            with conn.cursor(cursor_factory=factory) as cur:
                yield cur
    finally:
        conn.close()


def ensure_schema() -> None:
    """Tạo bảng và index nếu chưa có. Gọi lại nhiều lần không sao."""
    global _ready
    if _ready:
        return
    with _ready_lock:
        if _ready:
            return
        with _transaction() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(%s)", (_SCHEMA_LOCK_KEY,))
            cur.execute(SCHEMA_SQL)
        _ready = True
        log.info("Bảng %s sẵn sàng", TABLE)


def vector_literal(vector: list[float]) -> str:
    # Gửi dạng chữ '[x,y,...]' rồi ép kiểu trong SQL: khỏi cần thư viện pgvector cho Python.
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


# ---------- Dựng câu SQL: hàm thuần, test được không cần database ----------


def build_search(workspace_id: str, meeting_ids: list[str], vector: list[float], limit: int) -> tuple[str, dict[str, Any]]:
    """Tìm theo khoảng cách cosine, CHỈ trong các cuộc họp được phép xem."""
    sql = f"""
SELECT id, meeting_id, meeting_title, source_type, source_id, source_version,
       chunk_index, content, start_ms, end_ms, metadata,
       embedding <=> %(vector)s::public.vector AS distance
FROM {TABLE}
WHERE workspace_id = %(workspace_id)s
  AND meeting_id = ANY(%(meeting_ids)s::text[])
  AND index_status = 'indexed'
  AND embedding IS NOT NULL
ORDER BY embedding <=> %(vector)s::public.vector
LIMIT %(limit)s
"""
    params = {
        "workspace_id": workspace_id,
        "meeting_ids": list(meeting_ids),
        "vector": vector_literal(vector),
        "limit": int(limit),
    }
    return sql, params


def build_sources(workspace_id: str, meeting_ids: list[str]) -> tuple[str, dict[str, Any]]:
    sql = f"""
SELECT meeting_id,
       max(meeting_title) AS meeting_title,
       source_type,
       source_id,
       (array_agg(metadata->>'sourceTitle' ORDER BY chunk_index))[1] AS title,
       count(*) AS chunks,
       max(updated_at) AS indexed_at
FROM {TABLE}
WHERE workspace_id = %(workspace_id)s
  AND meeting_id = ANY(%(meeting_ids)s::text[])
  AND index_status = 'indexed'
GROUP BY meeting_id, source_type, source_id
ORDER BY meeting_id,
         array_position(ARRAY['transcript','minutes','decision','action_item','document'], source_type),
         max(updated_at) DESC
"""
    return sql, {"workspace_id": workspace_id, "meeting_ids": list(meeting_ids)}


def build_replace_delete(workspace_id: str, meeting_id: str, source_type: str, source_id: str) -> tuple[str, dict[str, Any]]:
    """Xoá bản cũ của nguồn; transcript/biên bản xoá luôn các phiên bản khác cùng cuộc họp."""
    sql = f"""
DELETE FROM {TABLE}
WHERE workspace_id = %(workspace_id)s
  AND source_type = %(source_type)s
  AND (source_id = %(source_id)s OR (%(whole_meeting)s AND meeting_id = %(meeting_id)s))
"""
    params = {
        "workspace_id": workspace_id,
        "source_type": source_type,
        "source_id": source_id,
        "meeting_id": meeting_id,
        "whole_meeting": source_type in VERSIONED_SOURCES,
    }
    return sql, params


def build_delete(
    workspace_id: str,
    meeting_id: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """Xoá các đoạn khớp mọi trường được gửi; luôn giới hạn trong workspace."""
    fields = {"meeting_id": meeting_id, "source_type": source_type, "source_id": source_id}
    given = {k: v for k, v in fields.items() if v}
    if not given:
        # Không có điều kiện nào thì câu lệnh sẽ xoá sạch cả workspace.
        raise ValueError("knowledge.delete.requested cần ít nhất meetingId, sourceType hoặc sourceId")
    where = " AND ".join(f"{k} = %({k})s" for k in given)
    sql = f"DELETE FROM {TABLE} WHERE workspace_id = %(workspace_id)s AND {where}"
    return sql, {"workspace_id": workspace_id, **given}


# ---------- Thao tác ----------


def replace_source(
    *,
    workspace_id: str,
    project_id: str | None,
    meeting_id: str,
    meeting_title: str,
    source_type: str,
    source_id: str,
    source_version: str | None,
    embedding_model: str,
    chunks: list[dict[str, Any]],
) -> tuple[int, int]:
    """Thay toàn bộ đoạn của một nguồn trong một transaction; trả (số xoá, số ghi).

    chunks: [{content, start_ms, end_ms, metadata, embedding}] theo thứ tự.
    Nhận lại cùng một lệnh thì kết quả vẫn y như cũ (idempotent).
    """
    ensure_schema()
    rows = [
        {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "project_id": project_id,
            "meeting_id": meeting_id,
            "meeting_title": meeting_title,
            "source_type": source_type,
            "source_id": source_id,
            "source_version": source_version,
            "chunk_index": index,
            "content": chunk["content"],
            "start_ms": chunk.get("start_ms"),
            "end_ms": chunk.get("end_ms"),
            "metadata": json.dumps(chunk.get("metadata") or {}, ensure_ascii=False),
            "embedding": vector_literal(chunk["embedding"]),
            "embedding_model": embedding_model,
        }
        for index, chunk in enumerate(chunks)
    ]
    # Hai lệnh cho cùng nguồn chạy song song (nhiều worker) sẽ đan xen xoá/ghi
    # và để lại đoạn trùng; khoá theo nguồn (hoặc theo cuộc họp với nguồn có
    # phiên bản) bắt chúng chạy lần lượt.
    if source_type in VERSIONED_SOURCES:
        lock_key = f"{workspace_id}|{meeting_id}|{source_type}"
    else:
        lock_key = f"{workspace_id}|{source_type}|{source_id}"
    delete_sql, delete_params = build_replace_delete(workspace_id, meeting_id, source_type, source_id)
    with _transaction() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (lock_key,))
        cur.execute(delete_sql, delete_params)
        deleted = cur.rowcount
        if rows:
            psycopg2.extras.execute_values(
                cur,
                f"INSERT INTO {TABLE} ({_COLUMNS}) VALUES %s",
                rows,
                template=_INSERT_TEMPLATE,
                page_size=100,
            )
    return deleted, len(rows)


def delete_chunks(
    workspace_id: str,
    meeting_id: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
) -> int:
    ensure_schema()
    sql, params = build_delete(workspace_id, meeting_id, source_type, source_id)
    with _transaction() as cur:
        cur.execute(sql, params)
        return cur.rowcount


def search(workspace_id: str, meeting_ids: list[str], vector: list[float], limit: int = 24) -> list[dict[str, Any]]:
    if not meeting_ids:
        return []
    ensure_schema()
    sql, params = build_search(workspace_id, meeting_ids, vector, limit)
    with _transaction(dict_rows=True) as cur:
        # Khi Postgres chọn index HNSW, bộ lọc quyền áp SAU khi duyệt đồ thị
        # nên có thể hụt kết quả; iterative_scan (pgvector ≥ 0.8) duyệt tiếp
        # tới khi đủ số dòng đã lọc, strict_order giữ đúng thứ tự khoảng cách.
        cur.execute("SET LOCAL hnsw.iterative_scan = strict_order")
        cur.execute("SET LOCAL hnsw.ef_search = 100")
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def list_sources(workspace_id: str, meeting_ids: list[str]) -> list[dict[str, Any]]:
    if not meeting_ids:
        return []
    ensure_schema()
    sql, params = build_sources(workspace_id, meeting_ids)
    with _transaction(dict_rows=True) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]
