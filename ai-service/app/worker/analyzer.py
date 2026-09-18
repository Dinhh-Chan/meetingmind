"""Tóm tắt và trích xuất công việc. Stub để thông luồng; Claude khi bật AI_LLM=claude."""

import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

log = logging.getLogger("ai-worker")


@dataclass
class AnalysisResult:
    run_id: str
    model: str
    summary: str = ""
    open_issues: list[str] = field(default_factory=list)
    decisions: list[dict[str, Any]] = field(default_factory=list)
    action_items: list[dict[str, Any]] = field(default_factory=list)


class Analyzer(Protocol):
    async def analyze(
        self, meeting_id: str, transcript_version_id: str, language: str
    ) -> AnalysisResult: ...


class StubAnalyzer:
    """Kết quả cố định, bám theo ví dụ trong tài liệu nghiệp vụ mục 7.

    Chú ý hai điều mà bản thật cũng phải giữ:
    - "hay là dùng JWT" là đề xuất, không phải quyết định đã thống nhất.
    - Câu nguồn không nói ai duyệt và hạn kiểm thử là bao giờ, nên để trống.
    """

    async def analyze(
        self, meeting_id: str, transcript_version_id: str, language: str
    ) -> AnalysisResult:
        log.warning("Đang dùng StubAnalyzer (AI_LLM chưa bật)")
        return AnalysisResult(
            run_id=str(uuid.uuid4()),
            model="stub",
            summary="Cuộc họp chốt phạm vi phần đăng nhập và phân công người thực hiện.",
            open_issues=["Chưa chốt dùng JWT hay session"],
            decisions=[],
            action_items=[
                {
                    "title": "Làm API đăng nhập",
                    "description": "Gửi bản đầu tiên để kiểm thử",
                    "assigneeHint": "Nam",
                    "deadlineRawText": "thứ Sáu",
                    "priority": "high",
                    "confidence": 0.8,
                    "quote": "Nam phụ trách API đăng nhập, thứ Sáu gửi bản đầu tiên để Lan kiểm thử.",
                    "transcriptSequence": 2,
                },
                {
                    "title": "Kiểm thử API đăng nhập",
                    "assigneeHint": "Lan",
                    "priority": "medium",
                    "confidence": 0.6,
                    "quote": "thứ Sáu gửi bản đầu tiên để Lan kiểm thử.",
                    "transcriptSequence": 2,
                },
            ],
        )


def get_analyzer() -> Analyzer:
    engine = os.environ.get("AI_LLM", "stub").lower()
    if engine == "claude":
        from app.worker.claude_analyzer import ClaudeAnalyzer

        return ClaudeAnalyzer()
    return StubAnalyzer()
