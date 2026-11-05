"""Hợp đồng HTTP hỏi đáp nội bộ (contracts/events.json, mục http). Tên trường camelCase như Core gửi."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

MAX_HISTORY = 6


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AskRequest(BaseModel):
    workspaceId: str = Field(min_length=1, max_length=200)
    # Câu hỏi dài hơn thế thường là dán cả văn bản vào; chặn để prompt không phình.
    question: str = Field(min_length=1, max_length=1000)
    # Core đã lọc theo quyền người hỏi; rỗng nghĩa là không được xem cuộc họp nào.
    meetingIds: List[str] = Field(default_factory=list, max_length=5000)
    history: List[ChatTurn] = Field(default_factory=list)

    @field_validator("question")
    @classmethod
    def _question_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("question rỗng")
        return value.strip()

    @field_validator("history")
    @classmethod
    def _recent_history(cls, value: List[ChatTurn]) -> List[ChatTurn]:
        # Hợp đồng là tối đa 6 lượt gần nhất; Core gửi dư thì cắt chứ không từ chối cả câu hỏi.
        return value[-MAX_HISTORY:]


class SourcesRequest(BaseModel):
    workspaceId: str = Field(min_length=1, max_length=200)
    meetingIds: List[str] = Field(default_factory=list, max_length=5000)


class Citation(BaseModel):
    n: int
    meetingId: str
    meetingTitle: Optional[str] = None
    sourceType: str
    sourceId: str
    startMs: Optional[int] = None
    speaker: Optional[str] = None
    quote: str


class AskResponse(BaseModel):
    answer: str
    list: Optional[List[str]] = None
    insufficient: bool
    model: str
    citations: List[Citation]


class SourceSummary(BaseModel):
    meetingId: str
    meetingTitle: Optional[str] = None
    sourceType: str
    sourceId: str
    title: str
    chunks: int
    indexedAt: Optional[str] = None
