"""Câu SQL của kho tri thức: bộ lọc quyền nằm trong WHERE, xoá đúng phạm vi.

Chỉ kiểm tra câu lệnh dựng ra, không cần database.
"""

import re

import pytest

from app.worker.knowledge_store import (
    SCHEMA_SQL,
    build_delete,
    build_replace_delete,
    build_search,
    build_sources,
    vector_literal,
)


def _where(sql: str) -> str:
    """Phần điều kiện lọc, trước ORDER BY / GROUP BY."""
    return re.split(r"\b(?:ORDER|GROUP) BY\b", sql.split("WHERE", 1)[1])[0]


def test_search_filters_workspace_meetings_and_status_before_ranking():
    sql, params = build_search("ws1", ["m1", "m2"], [0.5, -1], 24)
    where = _where(sql)
    assert "workspace_id = %(workspace_id)s" in where
    assert "meeting_id = ANY(%(meeting_ids)s::text[])" in where
    assert "index_status = 'indexed'" in where
    assert sql.index("WHERE") < sql.index("ORDER BY embedding <=>") < sql.index("LIMIT")
    assert params["workspace_id"] == "ws1"
    assert params["meeting_ids"] == ["m1", "m2"]
    assert params["vector"] == "[0.5,-1.0]"
    assert params["limit"] == 24


def test_sources_query_uses_same_permission_filter():
    sql, params = build_sources("ws1", ["m1"])
    where = _where(sql)
    assert "workspace_id = %(workspace_id)s" in where
    assert "meeting_id = ANY(%(meeting_ids)s::text[])" in where
    assert "index_status = 'indexed'" in where
    assert params == {"workspace_id": "ws1", "meeting_ids": ["m1"]}


def test_replace_deletes_other_versions_only_for_transcript_and_minutes():
    for source_type, whole in (("transcript", True), ("minutes", True), ("decision", False), ("document", False)):
        sql, params = build_replace_delete("ws", "m1", source_type, "s2")
        assert "workspace_id = %(workspace_id)s" in sql and "source_type = %(source_type)s" in sql
        assert params["whole_meeting"] is whole
        assert params["meeting_id"] == "m1" and params["source_id"] == "s2"


def test_delete_requires_a_field_and_stays_in_workspace():
    with pytest.raises(ValueError):
        build_delete("ws")
    sql, params = build_delete("ws", meeting_id="m1")
    assert sql.endswith("WHERE workspace_id = %(workspace_id)s AND meeting_id = %(meeting_id)s")
    assert params == {"workspace_id": "ws", "meeting_id": "m1"}
    sql, params = build_delete("ws", source_type="document", source_id="f1")
    assert "source_type = %(source_type)s AND source_id = %(source_id)s" in sql
    assert "meeting_id" not in params


def test_schema_has_table_and_indexes():
    assert "CREATE TABLE IF NOT EXISTS ai.document_chunks" in SCHEMA_SQL
    assert "embedding       public.vector(1024)" in SCHEMA_SQL
    assert "(workspace_id, meeting_id)" in SCHEMA_SQL
    assert "(source_type, source_id)" in SCHEMA_SQL
    assert "USING hnsw (embedding public.vector_cosine_ops)" in SCHEMA_SQL
    assert vector_literal([1, 2.5]) == "[1.0,2.5]"
