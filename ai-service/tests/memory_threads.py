"""ThreadStore trong bộ nhớ cho test: cùng ngữ nghĩa với SQL thật (đúng chủ, chưa xoá, thứ tự)."""

from typing import Any

from app.worker.knowledge_threads import ThreadNotFound


class MemoryThreads:
    def __init__(self) -> None:
        self.threads: dict[str, dict[str, Any]] = {}
        self.messages: list[dict[str, Any]] = []

    def _owned(self, workspace_id: str, user_id: str, thread_id: str) -> dict[str, Any] | None:
        thread = self.threads.get(thread_id)
        if thread and thread["workspace_id"] == workspace_id and thread["user_id"] == user_id and thread["deleted_at"] is None:
            return thread
        return None

    def _of(self, workspace_id: str, thread_id: str) -> list[dict[str, Any]]:
        rows = [m for m in self.messages if m["thread_id"] == thread_id and m["workspace_id"] == workspace_id]
        return sorted(rows, key=lambda m: m["created_at"])

    def find(self, workspace_id, user_id, thread_id):
        thread = self._owned(workspace_id, user_id, thread_id)
        return dict(thread) if thread else None

    def recent_messages(self, workspace_id, thread_id, limit=6):
        return [dict(m) for m in self._of(workspace_id, thread_id)[-limit:]]

    def thread_messages(self, workspace_id, thread_id):
        return [dict(m) for m in self._of(workspace_id, thread_id)]

    def save_turn(self, *, workspace_id, user_id, thread_id, create, title, messages, at):
        if create:
            self.threads[thread_id] = {
                "id": thread_id,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "title": title,
                "created_at": messages[0]["created_at"],
                "updated_at": at,
                "deleted_at": None,
            }
        else:
            thread = self._owned(workspace_id, user_id, thread_id)
            if thread is None:
                raise ThreadNotFound(thread_id)
            thread["updated_at"] = max(thread["updated_at"], at)
        for message in messages:
            self.messages.append({"list": None, "citations": [], "insufficient_evidence": False, "model": None, **message, "thread_id": thread_id, "workspace_id": workspace_id})

    def list_threads(self, workspace_id, user_id):
        rows = [
            {**t, "message_count": sum(1 for m in self.messages if m["thread_id"] == t["id"])}
            for t in self.threads.values()
            if t["workspace_id"] == workspace_id and t["user_id"] == user_id and t["deleted_at"] is None
        ]
        return sorted(rows, key=lambda t: (t["updated_at"], t["created_at"]), reverse=True)

    def rename(self, workspace_id, user_id, thread_id, title):
        thread = self._owned(workspace_id, user_id, thread_id)
        if thread is None:
            return None
        thread["title"] = title
        return {"id": thread_id, "title": title}

    def delete(self, workspace_id, user_id, thread_id):
        thread = self._owned(workspace_id, user_id, thread_id)
        if thread is None:
            return False
        thread["deleted_at"] = "deleted"
        return True
