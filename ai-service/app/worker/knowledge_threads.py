"""Bảng ai.chat_threads, ai.chat_messages: lịch sử hỏi đáp tri thức lưu phía máy chủ.

Lưu ở đây chứ không để trình duyệt giữ rồi gửi lên: ngữ cảnh lượt trước đưa
vào model phải đúng là những gì hệ thống đã trả lời, client không chèn được
lượt "assistant" giả để lái model.

Mỗi bản cài phục vụ một công ty nên chủ hội thoại là (workspace_id, user_id);
Core đã xác thực người hỏi. Mọi câu đọc/sửa đều kèm hai cột đó trong WHERE:
hội thoại của người khác coi như không tồn tại (API trả 404, không lộ là có
thật). Xoá là xoá mềm (deleted_at) để còn tra lại khi cần.
"""

import json
import logging
import threading
import uuid
from datetime import datetime
from typing import Any

import psycopg2.extras

from app.worker import knowledge_store as store

log = logging.getLogger("app.knowledge")

THREADS = f"{store.SCHEMA}.chat_threads"
MESSAGES = f"{store.SCHEMA}.chat_messages"

# Số tin gần nhất làm ngữ cảnh: đủ cho câu hỏi nối tiếp ("người đó"), không
# làm prompt phình theo độ dài hội thoại.
HISTORY_MESSAGES = 6
TITLE_CHARS = 80
# Chặn trên danh sách: một người hiếm khi cần cuộn quá chừng này hội thoại.
LIST_LIMIT = 200

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {THREADS} (
    id           text PRIMARY KEY,
    workspace_id text NOT NULL,
    user_id      text NOT NULL,
    scope_type   text NOT NULL DEFAULT 'workspace',
    scope_id     text,
    title        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS chat_threads_owner_idx
    ON {THREADS} (workspace_id, user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS {MESSAGES} (
    id                    text PRIMARY KEY,
    workspace_id          text NOT NULL,
    thread_id             text NOT NULL REFERENCES {THREADS} (id) ON DELETE CASCADE,
    role                  text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content               text NOT NULL,
    list                  jsonb,
    citations             jsonb NOT NULL DEFAULT '[]'::jsonb,
    insufficient_evidence boolean NOT NULL DEFAULT false,
    model                 text,
    created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_thread_idx
    ON {MESSAGES} (thread_id, created_at);
"""

# Điều kiện "đúng chủ, chưa xoá" dùng chung cho mọi câu chạm tới một hội thoại.
_OWNED = (
    "id = %(thread_id)s AND workspace_id = %(workspace_id)s "
    "AND user_id = %(user_id)s AND deleted_at IS NULL"
)

_MESSAGE_COLUMNS = "id, workspace_id, thread_id, role, content, list, citations, insufficient_evidence, model, created_at"
_MESSAGE_TEMPLATE = (
    "(%(id)s, %(workspace_id)s, %(thread_id)s, %(role)s, %(content)s, %(list)s::jsonb, "
    "%(citations)s::jsonb, %(insufficient_evidence)s, %(model)s, %(created_at)s)"
)

_ready = False
_ready_lock = threading.Lock()


class ThreadNotFound(LookupError):
    """Hội thoại không có, đã xoá, hoặc thuộc người/workspace khác."""


def ensure_schema() -> None:
    """Tạo hai bảng hội thoại nếu chưa có. Gọi lại nhiều lần không sao."""
    global _ready
    if _ready:
        return
    with _ready_lock:
        if _ready:
            return
        with store._transaction() as cur:
            # Cùng khoá với document_chunks: ai-service và ai-worker khởi động song song.
            cur.execute("SELECT pg_advisory_xact_lock(%s)", (store._SCHEMA_LOCK_KEY,))
            cur.execute(SCHEMA_SQL)
        _ready = True
        log.info("Bảng %s, %s sẵn sàng", THREADS, MESSAGES)


def new_id() -> str:
    return str(uuid.uuid4())


def thread_title(question: str, limit: int = TITLE_CHARS) -> str:
    """Tiêu đề mặc định: đầu câu hỏi, cắt ở ranh giới từ để không đứt giữa chữ."""
    text = " ".join(str(question or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(" ")
    # Một "từ" dài bất thường (đường dẫn, mã) thì cắt cứng còn hơn tiêu đề cụt ngủn.
    if space >= limit // 2:
        cut = cut[:space]
    return cut.rstrip(" ,.;:-–") + "…"


def _iso(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else value


def thread_summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "threadId": row["id"],
        "title": row.get("title"),
        "messageCount": int(row.get("message_count") or 0),
        "createdAt": _iso(row.get("created_at")),
        "updatedAt": _iso(row.get("updated_at")),
    }


def message_view(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "messageId": row["id"],
        "role": row["role"],
        "content": row["content"],
        "list": row.get("list") or None,
        "citations": row.get("citations") or [],
        "insufficient": bool(row.get("insufficient_evidence")),
        "model": row.get("model"),
        "createdAt": _iso(row.get("created_at")),
    }


# ---------- Dựng câu SQL: hàm thuần, test được không cần database ----------


def _owner(workspace_id: str, user_id: str, thread_id: str) -> dict[str, Any]:
    return {"workspace_id": workspace_id, "user_id": user_id, "thread_id": thread_id}


def build_find(workspace_id: str, user_id: str, thread_id: str) -> tuple[str, dict[str, Any]]:
    sql = f"SELECT id, title, created_at, updated_at FROM {THREADS} WHERE {_OWNED}"
    return sql, _owner(workspace_id, user_id, thread_id)


def build_list(workspace_id: str, user_id: str, limit: int = LIST_LIMIT) -> tuple[str, dict[str, Any]]:
    sql = f"""
SELECT t.id, t.title, t.created_at, t.updated_at,
       (SELECT count(*) FROM {MESSAGES} m WHERE m.thread_id = t.id) AS message_count
FROM {THREADS} t
WHERE t.workspace_id = %(workspace_id)s
  AND t.user_id = %(user_id)s
  AND t.deleted_at IS NULL
ORDER BY t.updated_at DESC, t.created_at DESC
LIMIT %(limit)s
"""
    return sql, {"workspace_id": workspace_id, "user_id": user_id, "limit": int(limit)}


def build_messages(workspace_id: str, thread_id: str, limit: int | None = None) -> tuple[str, dict[str, Any]]:
    """Tin của hội thoại; có limit thì lấy limit tin MỚI NHẤT (thứ tự giảm dần)."""
    order = "DESC" if limit else "ASC"
    sql = f"""
SELECT id, role, content, list, citations, insufficient_evidence, model, created_at
FROM {MESSAGES}
WHERE thread_id = %(thread_id)s AND workspace_id = %(workspace_id)s
ORDER BY created_at {order}, id {order}
"""
    params: dict[str, Any] = {"workspace_id": workspace_id, "thread_id": thread_id}
    if limit:
        sql += "LIMIT %(limit)s\n"
        params["limit"] = int(limit)
    return sql, params


def build_touch(workspace_id: str, user_id: str, thread_id: str, at: datetime) -> tuple[str, dict[str, Any]]:
    # GREATEST: hai câu hỏi song song trong cùng hội thoại không kéo mốc lùi lại.
    sql = f"UPDATE {THREADS} SET updated_at = GREATEST(updated_at, %(at)s) WHERE {_OWNED}"
    return sql, {**_owner(workspace_id, user_id, thread_id), "at": at}


def build_rename(workspace_id: str, user_id: str, thread_id: str, title: str) -> tuple[str, dict[str, Any]]:
    # Không đổi updated_at: đó là mốc hỏi đáp cuối để sắp danh sách, đổi tên
    # mà nhảy lên đầu danh sách thì người dùng tưởng có tin mới.
    sql = f"UPDATE {THREADS} SET title = %(title)s WHERE {_OWNED} RETURNING id, title"
    return sql, {**_owner(workspace_id, user_id, thread_id), "title": title}


def build_delete(workspace_id: str, user_id: str, thread_id: str) -> tuple[str, dict[str, Any]]:
    sql = f"UPDATE {THREADS} SET deleted_at = now() WHERE {_OWNED}"
    return sql, _owner(workspace_id, user_id, thread_id)


def _message_row(workspace_id: str, thread_id: str, message: dict[str, Any]) -> dict[str, Any]:
    items = message.get("list")
    return {
        "id": message["id"],
        "workspace_id": workspace_id,
        "thread_id": thread_id,
        "role": message["role"],
        "content": message["content"],
        "list": json.dumps(items, ensure_ascii=False) if items else None,
        "citations": json.dumps(message.get("citations") or [], ensure_ascii=False),
        "insufficient_evidence": bool(message.get("insufficient_evidence")),
        "model": message.get("model"),
        "created_at": message["created_at"],
    }


# ---------- Thao tác ----------


class ThreadStore:
    """Đọc/ghi hội thoại; tách thành lớp để test thay bằng bản trong bộ nhớ."""

    def find(self, workspace_id: str, user_id: str, thread_id: str) -> dict[str, Any] | None:
        ensure_schema()
        sql, params = build_find(workspace_id, user_id, thread_id)
        with store._transaction(dict_rows=True) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
        return dict(row) if row else None

    def recent_messages(self, workspace_id: str, thread_id: str, limit: int = HISTORY_MESSAGES) -> list[dict[str, Any]]:
        """limit tin gần nhất, xếp cũ → mới như thứ tự hội thoại."""
        ensure_schema()
        sql, params = build_messages(workspace_id, thread_id, limit)
        with store._transaction(dict_rows=True) as cur:
            cur.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]
        return rows[::-1]

    def thread_messages(self, workspace_id: str, thread_id: str) -> list[dict[str, Any]]:
        ensure_schema()
        sql, params = build_messages(workspace_id, thread_id)
        with store._transaction(dict_rows=True) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def save_turn(
        self,
        *,
        workspace_id: str,
        user_id: str,
        thread_id: str,
        create: bool,
        title: str | None,
        messages: list[dict[str, Any]],
        at: datetime,
    ) -> None:
        """Ghi lượt hỏi + lượt trả lời trong một transaction (tạo hội thoại nếu create).

        Hội thoại bị xoá trong lúc đang trả lời thì ThreadNotFound, không ghi gì.
        """
        ensure_schema()
        rows = [_message_row(workspace_id, thread_id, m) for m in messages]
        with store._transaction() as cur:
            if create:
                cur.execute(
                    f"INSERT INTO {THREADS} (id, workspace_id, user_id, scope_type, title, created_at, updated_at) "
                    "VALUES (%(thread_id)s, %(workspace_id)s, %(user_id)s, 'workspace', %(title)s, %(created_at)s, %(at)s)",
                    {
                        **_owner(workspace_id, user_id, thread_id),
                        "title": title,
                        "created_at": messages[0]["created_at"] if messages else at,
                        "at": at,
                    },
                )
            else:
                cur.execute(*build_touch(workspace_id, user_id, thread_id, at))
                if cur.rowcount == 0:
                    raise ThreadNotFound(thread_id)
            psycopg2.extras.execute_values(
                cur,
                f"INSERT INTO {MESSAGES} ({_MESSAGE_COLUMNS}) VALUES %s",
                rows,
                template=_MESSAGE_TEMPLATE,
            )

    def list_threads(self, workspace_id: str, user_id: str) -> list[dict[str, Any]]:
        ensure_schema()
        sql, params = build_list(workspace_id, user_id)
        with store._transaction(dict_rows=True) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def rename(self, workspace_id: str, user_id: str, thread_id: str, title: str) -> dict[str, Any] | None:
        ensure_schema()
        sql, params = build_rename(workspace_id, user_id, thread_id, title)
        with store._transaction(dict_rows=True) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
        return dict(row) if row else None

    def delete(self, workspace_id: str, user_id: str, thread_id: str) -> bool:
        ensure_schema()
        sql, params = build_delete(workspace_id, user_id, thread_id)
        with store._transaction() as cur:
            cur.execute(sql, params)
            return cur.rowcount > 0
