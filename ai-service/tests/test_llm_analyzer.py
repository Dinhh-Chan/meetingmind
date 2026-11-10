"""LlmAnalyzer: dựng prompt, bóc JSON, chuẩn hoá, đổi sang model dự phòng.

Không gọi mạng: httpx.MockTransport đóng vai gateway.
"""

import asyncio
import json

import httpx
import pytest

from app.worker.llm_analyzer import (
    LlmAnalyzer,
    LlmError,
    Settings,
    build_messages,
    ground,
    normalize,
    parse_json,
)

SEGMENTS = [
    {"sequence": 0, "speaker": "Lan", "text": "Thanh toán thì sao Hùng?", "startMs": 0, "endMs": 1000},
    {"sequence": 1, "speaker": "Hùng", "text": "Chắc ngày 15 xong. À không, ngày 18 đi chị.", "startMs": 1000, "endMs": 4000},
    {"sequence": 2, "speaker": "Lan", "text": "Ok 18/11 nhé. Chốt dùng PostgreSQL.", "startMs": 4000, "endMs": 6000},
]

GOOD = {
    "summary": "Chốt hạn thanh toán.",
    "decisions": [{"title": "Dùng PostgreSQL", "quote": "Chốt dùng PostgreSQL", "transcriptSequence": 2}],
    "openIssues": ["Chưa chốt cổng thanh toán phụ"],
    "actionItems": [
        {
            "title": "Tích hợp VNPay",
            "assigneeHint": "Hùng",
            "deadlineRawText": "18/11",
            "priority": "high",
            "confidence": 0.9,
            "quote": "Ok 18/11 nhé",
            "transcriptSequence": 2,
        }
    ],
}


def settings(**kw) -> Settings:
    base = {"base_url": "https://gw.test/v1", "api_key": "k", "model": "main", "fallback_model": "backup"}
    base.update(kw)
    return Settings(**base)


def sse(*chunks: dict) -> httpx.Response:
    body = "".join(f"data: {json.dumps(c, ensure_ascii=False)}\n\n" for c in chunks) + "data: [DONE]\n\n"
    return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})


def reply(content: str, finish: str = "stop") -> httpx.Response:
    """Luồng như gateway thật: vài mẩu suy luận, nội dung chia làm hai mẩu, rồi lý do kết thúc."""
    half = len(content) // 2
    return sse(
        {"choices": [{"delta": {"reasoning_content": "Cần đọc kỹ transcript…"}}]},
        {"choices": [{"delta": {"content": content[:half]}}]},
        {"choices": [{"delta": {"content": content[half:]}}]},
        {"choices": [{"delta": {}, "finish_reason": finish}]},
    )


def run(analyzer: LlmAnalyzer, segments=SEGMENTS):
    return asyncio.run(analyzer.analyze("m1", "v1", "vi", segments))


# ---------- prompt ----------


def test_build_messages_numbers_lines_and_names_language():
    messages = build_messages(SEGMENTS, "vi")
    assert "tiếng Việt" in messages[0]["content"]
    assert "[1] Hùng: Chắc ngày 15 xong." in messages[1]["content"]


def test_build_messages_unknown_language_falls_back_to_meeting_language():
    assert "ngôn ngữ chính của cuộc họp" in build_messages(SEGMENTS, "xx")[0]["content"]


# ---------- bóc JSON ----------


def test_parse_json_strips_code_fence():
    assert parse_json('```json\n{"summary": "a"}\n```') == {"summary": "a"}


def test_parse_json_finds_object_inside_chatter():
    assert parse_json('Đây là kết quả:\n{"summary": "a"}\nHết.') == {"summary": "a"}


@pytest.mark.parametrize("content", ["", "   ", "không có json", "[1, 2]"])
def test_parse_json_rejects_unusable(content):
    with pytest.raises(LlmError):
        parse_json(content)


# ---------- chuẩn hoá ----------


def test_ground_fixes_wrong_sequence_by_quote():
    texts = {s["sequence"]: s["text"] for s in SEGMENTS}
    assert ground("À không, ngày 18 đi chị", 0, texts) == 1


def test_ground_keeps_real_sequence_when_quote_not_found():
    texts = {s["sequence"]: s["text"] for s in SEGMENTS}
    assert ground("câu không có thật", 2, texts) == 2
    assert ground("câu không có thật", 99, texts) is None


def test_normalize_cleans_model_quirks():
    raw = {
        "summary": "  Tóm tắt  ",
        "decisions": [{"title": ""}, "rác", {"title": "Dùng PostgreSQL", "quote": "chốt dùng postgresql", "transcriptSequence": "7"}],
        "openIssues": [{"title": "Ngân sách"}, "", None],
        "actionItems": [
            {
                "title": "Tích hợp VNPay",
                "assigneeHint": "null",
                "deadlineRawText": "N/A",
                "priority": "URGENT",
                "confidence": "1.4",
                "quote": "Ok 18/11 nhé",
                "transcriptSequence": None,
            }
        ],
    }
    out = normalize(raw, SEGMENTS)
    assert out["summary"] == "Tóm tắt"
    assert out["decisions"] == [
        {"title": "Dùng PostgreSQL", "description": None, "quote": "chốt dùng postgresql", "transcriptSequence": 2}
    ]
    assert out["open_issues"] == ["Ngân sách"]
    item = out["action_items"][0]
    assert item["assigneeHint"] is None
    assert item["deadlineRawText"] is None
    assert item["priority"] == "medium"
    assert item["confidence"] == 1.0
    assert item["transcriptSequence"] == 2


# ---------- gọi model ----------


def test_analyze_uses_primary_model():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        calls.append(body["model"])
        assert request.headers["Authorization"] == "Bearer k"
        assert request.url.path == "/v1/chat/completions"
        assert "response_format" not in body
        assert body["stream"] is True
        return reply(json.dumps(GOOD, ensure_ascii=False))

    result = run(LlmAnalyzer(settings(), transport=httpx.MockTransport(handler)))
    assert calls == ["main"]
    assert result.model == "main"
    assert result.action_items[0]["assigneeHint"] == "Hùng"
    assert result.decisions[0]["transcriptSequence"] == 2


@pytest.mark.parametrize(
    "primary",
    [
        httpx.Response(402, json={"message": "Payment required"}),
        sse({"choices": [{"delta": {"reasoning_content": "chỉ nghĩ, không trả lời"}, "finish_reason": "stop"}]}),
        sse({"choices": [{"delta": {"content": '{"summ'}, "finish_reason": "length"}]}),
        sse({"error": {"message": "upstream reset"}}),
    ],
    ids=["http-error", "only-reasoning", "truncated", "error-mid-stream"],
)
def test_analyze_falls_back_when_primary_unusable(primary):
    def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["model"] == "main":
            return primary
        return reply(json.dumps(GOOD, ensure_ascii=False))

    result = run(LlmAnalyzer(settings(), transport=httpx.MockTransport(handler)))
    assert result.model == "backup"


def test_analyze_raises_with_both_errors_when_all_models_fail():
    transport = httpx.MockTransport(lambda request: httpx.Response(500, text="boom"))
    with pytest.raises(LlmError) as err:
        run(LlmAnalyzer(settings(), transport=transport))
    assert "main: HTTP 500" in str(err.value)
    assert "backup: HTTP 500" in str(err.value)


def test_analyze_without_fallback_tries_once():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(500, text="boom")

    with pytest.raises(LlmError):
        run(LlmAnalyzer(settings(fallback_model=""), transport=httpx.MockTransport(handler)))
    assert len(calls) == 1


def test_analyze_empty_transcript_skips_llm():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("không được gọi model khi transcript rỗng")

    result = run(LlmAnalyzer(settings(), transport=httpx.MockTransport(handler)), segments=[{"sequence": 0, "text": "  "}])
    assert result.model == "none"
    assert result.action_items == []


def test_analyze_accepts_plain_json_when_gateway_ignores_stream():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(GOOD)}}]})

    result = run(LlmAnalyzer(settings(), transport=httpx.MockTransport(handler)))
    assert result.model == "main"
    assert result.summary == "Chốt hạn thanh toán."


def test_analyze_falls_back_when_primary_too_slow():
    async def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["model"] == "main":
            await asyncio.sleep(1)
        return reply(json.dumps(GOOD, ensure_ascii=False))

    result = run(LlmAnalyzer(settings(timeout_s=0.2), transport=httpx.MockTransport(handler)))
    assert result.model == "backup"


def test_mau_bien_ban_dua_vao_prompt_va_giu_dung_thu_tu_muc():
    sections = ["Mục tiêu", "Quyết định", "Bước tiếp theo"]
    system = build_messages(SEGMENTS, "vi", sections)[0]["content"]
    assert "“Mục tiêu”; “Quyết định”; “Bước tiếp theo”" in system
    raw = {
        "summary": "x",
        "sections": [
            {"title": "quyết định", "content": "- Chốt phạm vi"},
            {"title": "Mục tiêu", "content": "Thống nhất kế hoạch"},
            {"title": "Mục lạ", "content": "bỏ"},
        ],
    }
    result = normalize(raw, SEGMENTS, sections)
    assert result["sections"] == [
        {"title": "Mục tiêu", "content": "Thống nhất kế hoạch"},
        {"title": "Quyết định", "content": "- Chốt phạm vi"},
        {"title": "Bước tiếp theo", "content": "Không có"},
    ]


def test_khong_co_mau_thi_khong_them_muc():
    assert "sections" not in build_messages(SEGMENTS, "vi")[0]["content"]
    assert normalize({"summary": "x"}, SEGMENTS)["sections"] == []
