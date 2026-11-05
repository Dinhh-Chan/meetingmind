"""Hỏi đáp RAG: đánh lại số trích dẫn, đọc câu trả lời, xếp hạng lại, nhúng vector.

Không gọi mạng: httpx.MockTransport đóng vai gateway FPT, hàm search giả đóng
vai database.
"""

import asyncio
import json

import httpx
import pytest

from app.worker.embeddings import EMBEDDING_DIM, EmbeddingClient, EmbeddingError, EmbeddingSettings
from app.worker.knowledge_qa import (
    INSUFFICIENT_ANSWER,
    KnowledgeError,
    KnowledgeQA,
    QaSettings,
    best_quote,
    build_qa_messages,
    finalize,
    renumber,
    retrieval_query,
    select_sources,
)

ROWS = [
    {
        "id": "c1",
        "meeting_id": "m1",
        "meeting_title": "Họp kiến trúc",
        "source_type": "transcript",
        "source_id": "tv1",
        "content": "[00:05] Lan: Chào cả nhóm.\n[01:10] Hùng: Em đề xuất dùng MongoDB.\n[02:03] Lan: Thôi chốt dùng PostgreSQL nhé, có pgvector.",
        "start_ms": 5_000,
        "end_ms": 130_000,
        "metadata": {"speaker": "Lan", "lineStartMs": [5_100, 70_400, 123_900]},
    },
    {
        "id": "c2",
        "meeting_id": "m1",
        "meeting_title": "Họp kiến trúc",
        "source_type": "action_item",
        "source_id": "ai1",
        "content": "Tích hợp VNPay\nHùng làm, hạn 18/11.",
        "start_ms": None,
        "end_ms": None,
        "metadata": {"title": "Tích hợp VNPay"},
    },
    {
        "id": "c3",
        "meeting_id": "m2",
        "meeting_title": "Họp sprint",
        "source_type": "decision",
        "source_id": "d1",
        "content": "Nhắc lịch\nHùng làm chức năng nhắc lịch.",
        "start_ms": None,
        "end_ms": None,
        "metadata": {"title": "Nhắc lịch"},
    },
]


def vec(x: float = 0.1) -> list[float]:
    return [x] * EMBEDDING_DIM


def sse(content: str) -> httpx.Response:
    chunks = [
        {"choices": [{"delta": {"reasoning_content": "nghĩ…"}}]},
        {"choices": [{"delta": {"content": content[: len(content) // 2]}}]},
        {"choices": [{"delta": {"content": content[len(content) // 2 :]}}]},
        {"choices": [{"delta": {}, "finish_reason": "stop"}]},
    ]
    body = "".join(f"data: {json.dumps(c, ensure_ascii=False)}\n\n" for c in chunks) + "data: [DONE]\n\n"
    return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})


# ---------- đánh lại số trích dẫn ----------


def test_renumber_by_first_use_and_drops_unknown_numbers():
    answer, items, order = renumber("Chốt PostgreSQL [3]. Hạn VNPay 18/11 [1, 3] và [9].", ["Hùng nhắc lịch [2]", "Lặp [3][3]"], k=3)
    assert order == [3, 1, 2]
    assert answer == "Chốt PostgreSQL [1]. Hạn VNPay 18/11 [2][1] và."
    assert items == ["Hùng nhắc lịch [3]", "Lặp [1]"]


def test_renumber_accepts_nguon_prefix():
    answer, _, order = renumber("Dùng PostgreSQL [Nguồn 2].", [], k=2)
    assert (answer, order) == ("Dùng PostgreSQL [1].", [2])


# ---------- đọc câu trả lời ----------


def test_finalize_builds_citations_with_line_time_and_quote():
    raw = {"answer": "Nhóm chốt dùng PostgreSQL [2]; MongoDB chỉ là đề xuất [2].", "citations": [2], "insufficient": False}
    sources = [ROWS[1], ROWS[0]]
    result = finalize(raw, sources, "Nhóm chốt dùng cơ sở dữ liệu gì?", "GLM-5.2")
    assert result["insufficient"] is False and result["model"] == "GLM-5.2"
    assert result["answer"] == "Nhóm chốt dùng PostgreSQL [1]; MongoDB chỉ là đề xuất [1]."
    [citation] = result["citations"]
    assert citation["n"] == 1 and citation["sourceId"] == "tv1" and citation["meetingId"] == "m1"
    assert citation["quote"] == "Thôi chốt dùng PostgreSQL nhé, có pgvector."
    assert citation["startMs"] == 123_900  # mốc chính xác của dòng, không phải đầu đoạn
    assert citation["speaker"] == "Lan"
    assert "list" not in result


def test_finalize_insufficient_uses_exact_sentence():
    raw = {"answer": "Không biết giá vàng.", "citations": [1], "insufficient": True}
    result = finalize(raw, ROWS, "Giá vàng hôm nay?", "GLM-5.2")
    assert result == {"answer": INSUFFICIENT_ANSWER, "insufficient": True, "model": "GLM-5.2", "citations": []}
    # Model quên cờ nhưng nói đúng câu từ chối: vẫn tính là thiếu thông tin.
    assert finalize({"answer": INSUFFICIENT_ANSWER}, ROWS, "x", "m")["insufficient"] is True
    assert finalize({"answer": "", "list": []}, ROWS, "x", "m")["insufficient"] is True


def test_finalize_list_and_fallback_citations():
    raw = {"answer": "Các việc được giao:", "list": ["- Hùng tích hợp VNPay [2]", "Hùng nhắc lịch [3]"], "citations": [2, 3]}
    result = finalize(raw, ROWS, "Hùng được giao việc gì?", "m")
    assert result["list"] == ["Hùng tích hợp VNPay [1]", "Hùng nhắc lịch [2]"]
    assert [c["sourceId"] for c in result["citations"]] == ["ai1", "d1"]
    assert "startMs" not in result["citations"][0]

    # Không có [n] trong câu nhưng khai citations: gắn cuối câu trả lời.
    result = finalize({"answer": "Chốt PostgreSQL.", "citations": [1]}, ROWS, "csdl?", "m")
    assert result["answer"] == "Chốt PostgreSQL. [1]" and len(result["citations"]) == 1


def test_best_quote_clips_long_sentence():
    row = {"source_type": "document", "content": ("chữ " * 100) + "VNPay hạn 18/11 " + ("đuôi " * 100), "metadata": {}}
    quote, start_ms, speaker = best_quote(row, {"vnpay"})
    assert len(quote) <= 220 and "VNPay" in quote and start_ms is None and speaker is None


def test_messages_strip_old_citations_from_history():
    messages = build_qa_messages("Ai làm?", ROWS[:1], [{"role": "assistant", "content": "Dùng PostgreSQL [1]."}])
    assert messages[1] == {"role": "assistant", "content": "Dùng PostgreSQL."}
    assert messages[-1]["content"].startswith('NGUỒN:\n\n[1] Cuộc họp "Họp kiến trúc" · Transcript · 00:05–02:10\n')
    assert retrieval_query("Ai làm?", [{"role": "user", "content": "VNPay thế nào?"}]) == "VNPay thế nào?\nAi làm?"


# ---------- xếp hạng lại ----------


def test_select_sources_floor_and_fallbacks():
    rows = [{"id": i} for i in range(8)]
    scores = [0.01, 0.9, 0.5, 0.001, 0.03, 0.2, 0.6, 0.7]
    assert [r["id"] for r in select_sources(rows, scores, keep=6, floor=0.02)] == [1, 7, 6, 2, 5, 4]
    # Không đoạn nào qua ngưỡng: vẫn đưa vài đoạn tốt nhất cho model tự kết luận.
    assert [r["id"] for r in select_sources(rows, [0.001] * 7 + [0.005], keep=6, floor=0.02, min_keep=3)] == [7, 0, 1]
    # Reranker lỗi: giữ thứ tự vector.
    assert [r["id"] for r in select_sources(rows, None, keep=6)] == [0, 1, 2, 3, 4, 5]


# ---------- cả luồng hỏi đáp ----------


class Gateway:
    """Gateway giả: ghi lại các lượt gọi, trả lời theo đường dẫn."""

    def __init__(self, rerank=None, chat=None):
        self.calls: list[str] = []
        self.rerank = rerank
        self.chat = chat or []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.calls.append(path)
        body = json.loads(request.content)
        if path.endswith("/embeddings"):
            return httpx.Response(200, json={"data": [{"index": i, "embedding": vec()} for i, _ in enumerate(body["input"])]})
        if path.endswith("/rerank"):
            return self.rerank(body) if self.rerank else httpx.Response(500, text="down")
        if path.endswith("/chat/completions"):
            return self.chat.pop(0)(body)
        return httpx.Response(404)


def make_qa(gateway: Gateway, rows=ROWS, searched: list | None = None) -> KnowledgeQA:
    transport = httpx.MockTransport(gateway)

    def search(workspace_id, meeting_ids, vector, limit):
        if searched is not None:
            searched.append((workspace_id, meeting_ids, limit))
        return [r for r in rows if r["meeting_id"] in meeting_ids]

    settings = QaSettings(base_url="https://gw.test/v1", api_key="k", model="main", fallback_model="backup")
    embedder = EmbeddingClient(EmbeddingSettings(base_url="https://gw.test/v1", api_key="k", retry_delay_s=0), transport=transport)
    return KnowledgeQA(settings=settings, search=search, list_sources=lambda *_: [], embedder=embedder, transport=transport)


def test_empty_meeting_ids_short_circuits_without_any_call():
    gateway = Gateway()
    searched: list = []
    result = asyncio.run(make_qa(gateway, searched=searched).ask("ws", "Chốt gì?", []))
    assert result == {"answer": INSUFFICIENT_ANSWER, "insufficient": True, "model": "none", "citations": []}
    assert gateway.calls == [] and searched == []


def test_no_indexed_chunks_returns_insufficient_without_llm():
    gateway = Gateway()
    result = asyncio.run(make_qa(gateway).ask("ws", "Chốt gì?", ["khac"]))
    assert result["insufficient"] is True and result["model"] == "none"
    assert gateway.calls == ["/v1/embeddings"]


def test_rerank_failure_falls_back_to_vector_order():
    seen_sources: list[str] = []

    def chat(body):
        seen_sources.append(body["messages"][-1]["content"])
        return sse(json.dumps({"answer": "Chốt PostgreSQL [1].", "citations": [1], "insufficient": False}, ensure_ascii=False))

    gateway = Gateway(rerank=None, chat=[chat])
    searched: list = []
    result = asyncio.run(make_qa(gateway, searched=searched).ask("ws", "Nhóm chốt dùng cơ sở dữ liệu gì?", ["m1", "m1", " "]))
    assert gateway.calls == ["/v1/embeddings", "/v1/rerank", "/v1/chat/completions"]
    assert searched == [("ws", ["m1"], 24)]  # đã khử trùng lặp, bỏ id rỗng
    # Thứ tự vector giữ nguyên: transcript là [1], công việc là [2].
    assert seen_sources[0].index("[1] Cuộc họp") < seen_sources[0].index("Transcript") < seen_sources[0].index("[2] Cuộc họp")
    assert result["citations"][0]["sourceId"] == "tv1"


def test_rerank_reorders_and_fallback_model_used_when_main_fails():
    def rerank(body):
        assert len(body["documents"]) == 2
        return httpx.Response(200, json={"results": [{"index": 1, "relevance_score": 0.8}, {"index": 0, "relevance_score": 0.001}]})

    def broken(body):
        assert body["model"] == "main"
        return httpx.Response(500, text="loi")

    def backup(body):
        assert body["model"] == "backup" and body["stream"] is True
        # Chỉ đoạn qua ngưỡng được gửi cho model.
        assert "Tích hợp VNPay" in body["messages"][-1]["content"]
        assert "PostgreSQL" not in body["messages"][-1]["content"]
        return sse("```json\n" + json.dumps({"answer": "Hùng làm VNPay, hạn 18/11 [1].", "citations": [1], "insufficient": False}, ensure_ascii=False) + "\n```")

    gateway = Gateway(rerank=rerank, chat=[broken, backup])
    result = asyncio.run(make_qa(gateway).ask("ws", "Hạn VNPay khi nào?", ["m1"]))
    assert result["model"] == "backup"
    assert result["citations"][0]["sourceType"] == "action_item"
    assert "18/11" in result["citations"][0]["quote"]


def test_both_models_fail_raises():
    gateway = Gateway(chat=[lambda b: httpx.Response(500), lambda b: sse("không phải JSON")])
    with pytest.raises(KnowledgeError):
        asyncio.run(make_qa(gateway).ask("ws", "Hỏi?", ["m1"]))


# ---------- nhúng vector ----------


def test_embeddings_batches_and_retries_once_on_5xx():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(503, text="busy")
        body = json.loads(request.content)
        assert len(body["input"]) <= 32 and body["model"] == "Vietnamese_Embedding"
        return httpx.Response(200, json={"data": [{"index": i, "embedding": vec(i)} for i in reversed(range(len(body["input"])))]})

    client = EmbeddingClient(EmbeddingSettings(api_key="k", retry_delay_s=0), transport=httpx.MockTransport(handler))
    vectors = asyncio.run(client.embed([f"t{i}" for i in range(70)]))
    assert len(vectors) == 70 and calls["n"] == 4  # 1 lỗi + 3 lô (32, 32, 6)
    assert vectors[1][0] == 1.0  # sắp lại theo index


def test_embeddings_errors():
    def always_500(request):
        return httpx.Response(500)

    client = EmbeddingClient(EmbeddingSettings(api_key="k", retry_delay_s=0), transport=httpx.MockTransport(always_500))
    with pytest.raises(EmbeddingError):
        asyncio.run(client.embed(["a"]))

    def wrong_dim(request):
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1] * 768}]})

    client = EmbeddingClient(EmbeddingSettings(api_key="k"), transport=httpx.MockTransport(wrong_dim))
    with pytest.raises(EmbeddingError, match="1024"):
        asyncio.run(client.embed(["a"]))

    with pytest.raises(EmbeddingError, match="AI_LLM_API_KEY"):
        asyncio.run(EmbeddingClient(EmbeddingSettings(api_key="")).embed(["a"]))
