"""Phân tích cuộc họp bằng LLM qua API kiểu OpenAI (mặc định FPT AI Factory).

Chọn model bằng cách chấm thử trên một cuộc họp tiếng Việt có đáp án (đề xuất
khác quyết định, hạn bị đính chính, đổi người làm giữa chừng, chuyện ngoài lề,
câu tiếng Anh xen kẽ, người nói chỉ có nhãn tự động):

- DeepSeek-V4.1-Flash: đúng trọn 3/3 lần, tóm tắt đầy đủ, nhưng ~1 phút vì có
  bước suy luận. Phân tích chạy nền sau Whisper nên chờ thêm vậy không sao.
- GLM-5.2: nhanh gấp ~10 lần, thỉnh thoảng sót việc bị đổi người làm. Dùng làm
  dự phòng khi model chính lỗi hoặc hết thời gian.

Cả hai do FPT tự host. Các model "resell" (Azure, Google, Alibaba…) cần nạp
tiền riêng và gửi dữ liệu ra ngoài FPT.

Không dùng response_format=json_object: DeepSeek-V4.1-Flash khi bật chế độ
này trả nội dung rỗng (dồn hết vào phần suy luận). Prompt yêu cầu JSON và phía
này tự bóc, tự kiểm tra.

Gọi theo luồng (stream): gọi thường thì cổng dịch vụ trả 524 khi mô hình suy
luận quá lâu (gặp khi chạy thực nghiệm), luồng giữ kết nối sống bằng token suy luận.
"""

import asyncio
import json
import logging
import os
import re
import unicodedata
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from app.worker.analyzer import AnalysisResult

log = logging.getLogger("ai-worker")

PRIORITIES = ("high", "medium", "low")

LANGUAGE_NAMES = {
    "vi": "tiếng Việt",
    "en": "tiếng Anh",
    "ja": "tiếng Nhật",
    "ko": "tiếng Hàn",
    "zh": "tiếng Trung",
    "fr": "tiếng Pháp",
}

SYSTEM_PROMPT = """Bạn là thư ký cuộc họp. Đọc transcript và trích xuất biên bản dưới dạng JSON.

Transcript gồm các dòng "[số thứ tự] Người nói: lời nói". Tên người nói có thể là tên thật hoặc nhãn tự động như "Người nói 2". Transcript do máy nhận dạng giọng nói nên có thể sai chính tả vài chỗ.

Quy tắc:
- Viết summary, title, description bằng {language}, kể cả khi trong cuộc họp có câu nói bằng ngôn ngữ khác.
- Quyết định (decisions): chỉ những điều cả nhóm đã chốt. Một đề xuất chưa ai đồng ý ("hay là…", "em nghĩ…") KHÔNG phải quyết định.
- Vấn đề còn mở (openIssues): câu hỏi hoặc lựa chọn chưa có kết luận trong cuộc họp.
- Công việc (actionItems): việc cụ thể có người nhận làm hoặc được giao.
  - assigneeHint: tên người thực hiện đúng như trong transcript. Nếu người nói chỉ có nhãn tự động nhưng được gọi tên ở chỗ khác thì dùng tên đó. Không rõ ai làm thì để null.
  - deadlineRawText: nguyên văn cụm chỉ thời hạn trong transcript (ví dụ "thứ Sáu", "18/11"). Không có thì null. Không tự đoán ngày.
  - priority: "high" | "medium" | "low".
  - confidence: 0–1, mức chắc chắn đây là việc thật được giao.
- Nếu sau đó có người đính chính (đổi hạn, đổi người làm, huỷ việc) thì lấy thông tin cuối cùng.
- Bỏ qua chuyện ngoài lề không liên quan công việc.
- quote: trích NGUYÊN VĂN một đoạn ngắn trong đúng dòng có số thứ tự transcriptSequence làm bằng chứng.
- Không bịa thông tin không có trong transcript. Cuộc họp không có quyết định hay công việc nào thì để mảng rỗng.

Chỉ trả về một object JSON, không kèm giải thích:
{{
  "summary": "tóm tắt 3–5 câu",
  "decisions": [{{"title": "", "description": "", "quote": "", "transcriptSequence": 0}}],
  "openIssues": [""],
  "actionItems": [{{"title": "", "description": "", "assigneeHint": null, "deadlineRawText": null, "priority": "medium", "confidence": 0.8, "quote": "", "transcriptSequence": 0}}]
}}"""


@dataclass(frozen=True)
class Settings:
    base_url: str = "https://token-api.fpt.ai/v1"
    api_key: str = ""
    model: str = "DeepSeek-V4.1-Flash"
    # Để trống thì không thử model thứ hai.
    fallback_model: str = "GLM-5.2"
    # Model suy luận cần nhiều token cho phần nghĩ trước khi ra JSON.
    max_tokens: int = 32000
    timeout_s: float = 600.0
    temperature: float = 0.2

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ.get
        return cls(
            base_url=env("AI_LLM_BASE_URL", cls.base_url).rstrip("/"),
            api_key=env("AI_LLM_API_KEY", cls.api_key),
            model=env("AI_LLM_MODEL", cls.model),
            fallback_model=env("AI_LLM_FALLBACK_MODEL", cls.fallback_model),
            max_tokens=int(env("AI_LLM_MAX_TOKENS", str(cls.max_tokens))),
            timeout_s=float(env("AI_LLM_TIMEOUT_S", str(cls.timeout_s))),
            temperature=float(env("AI_LLM_TEMPERATURE", str(cls.temperature))),
        )


class LlmError(Exception):
    """Model không trả được kết quả dùng được."""


# ---------- Dựng prompt và đọc kết quả: hàm thuần, test được không cần mạng ----------


TEMPLATE_PROMPT = """

Dự án dùng mẫu biên bản gồm các mục theo thứ tự: {titles}.
Thêm vào object JSON trường "sections": mỗi mục một phần tử {{"title": "<tên mục đúng như trên>", "content": "<nội dung>"}}, đúng thứ tự trên. Nội dung viết bằng {language}, ngắn gọn (gạch đầu dòng bắt đầu bằng "- " nếu có nhiều ý), chỉ dựa vào transcript. Mục không có thông tin thì content là "Không có"."""


def build_messages(
    segments: list[dict[str, Any]], language: str | None, template_sections: list[str] | None = None
) -> list[dict[str, str]]:
    name = LANGUAGE_NAMES.get((language or "vi").split("-")[0], "ngôn ngữ chính của cuộc họp")
    lines = [f"[{s['sequence']}] {s.get('speaker') or 'Không rõ'}: {s['text']}" for s in segments]
    system = SYSTEM_PROMPT.format(language=name)
    titles = [t.strip() for t in template_sections or [] if t and t.strip()]
    if titles:
        system += TEMPLATE_PROMPT.format(titles="; ".join(f"“{t}”" for t in titles), language=name)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "Transcript cuộc họp:\n\n" + "\n".join(lines)},
    ]


def parse_json(content: str | None) -> dict[str, Any]:
    """Bóc object JSON từ câu trả lời; model hay bọc trong ```json hoặc nói thêm."""
    if not content or not content.strip():
        raise LlmError("model trả nội dung rỗng")
    text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", content.strip())
    try:
        data = json.loads(text)
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise LlmError("không thấy JSON trong câu trả lời") from None
        try:
            data = json.loads(text[start : end + 1])
        except ValueError as err:
            raise LlmError(f"JSON hỏng: {err}") from None
    if not isinstance(data, dict):
        raise LlmError("JSON không phải object")
    return data


def _norm(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).lower().split())


def _text(value: Any) -> str | None:
    """Chuỗi đã gọt; model hay viết "null", "N/A" thay vì null."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in ("null", "none", "n/a", "không có", "không rõ"):
        return None
    return text


def _confidence(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(min(1.0, max(0.0, number)), 3)


def _sequence(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def ground(quote: str | None, sequence: int | None, texts: dict[int, str]) -> int | None:
    """Số thứ tự đoạn chứa câu trích.

    Model đôi khi trích đúng câu nhưng ghi lệch số dòng: dò lại theo nội dung.
    Không tìm thấy thì giữ số model đưa nếu số đó có thật.
    """
    needle = _norm(quote).strip(" .,\"'“”…") if quote else ""
    if needle:
        if sequence in texts and needle in _norm(texts[sequence]):
            return sequence
        for seq, text in texts.items():
            if needle in _norm(text):
                return seq
    return sequence if sequence in texts else None


def normalize(
    raw: dict[str, Any], segments: list[dict[str, Any]], template_sections: list[str] | None = None
) -> dict[str, Any]:
    """Đưa câu trả lời về đúng hình dạng hợp đồng analysis.completed."""
    texts = {int(s["sequence"]): str(s["text"]) for s in segments}

    def evidence(item: dict[str, Any]) -> dict[str, Any]:
        quote = _text(item.get("quote"))
        return {"quote": quote, "transcriptSequence": ground(quote, _sequence(item.get("transcriptSequence")), texts)}

    decisions = []
    for item in raw.get("decisions") or []:
        if not isinstance(item, dict) or not _text(item.get("title")):
            continue
        decisions.append({"title": _text(item["title"]), "description": _text(item.get("description")), **evidence(item)})

    action_items = []
    for item in raw.get("actionItems") or []:
        if not isinstance(item, dict) or not _text(item.get("title")):
            continue
        priority = str(item.get("priority") or "").strip().lower()
        action_items.append(
            {
                "title": _text(item["title"]),
                "description": _text(item.get("description")),
                "assigneeHint": _text(item.get("assigneeHint")),
                "deadlineRawText": _text(item.get("deadlineRawText")),
                "priority": priority if priority in PRIORITIES else "medium",
                "confidence": _confidence(item.get("confidence")),
                **evidence(item),
            }
        )

    open_issues = []
    for item in raw.get("openIssues") or []:
        title = _text(item.get("title") if isinstance(item, dict) else item)
        if title:
            open_issues.append(title)

    # Giữ đúng các mục và thứ tự của mẫu; mục model bỏ sót thì ghi "Không có".
    written = {}
    for item in raw.get("sections") or []:
        if isinstance(item, dict) and _text(item.get("title")):
            written[_text(item["title"]).casefold()] = _text(item.get("content")) or ""
    sections = [
        {"title": t.strip(), "content": written.get(t.strip().casefold()) or "Không có"}
        for t in template_sections or []
        if t and t.strip()
    ]

    return {
        "summary": _text(raw.get("summary")) or "",
        "decisions": decisions,
        "open_issues": open_issues,
        "action_items": action_items,
        "sections": sections,
    }


# ---------- Gọi model ----------


class LlmAnalyzer:
    def __init__(self, settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings or Settings.from_env()
        self._transport = transport

    async def analyze(
        self,
        meeting_id: str,
        transcript_version_id: str,
        language: str,
        segments: list[dict[str, Any]] | None = None,
        template_sections: list[str] | None = None,
    ) -> AnalysisResult:
        segments = [s for s in segments or [] if str(s.get("text") or "").strip()]
        if not segments:
            # Không có lời nào thì không có gì để tóm tắt; đừng để model bịa.
            log.warning("Transcript %s rỗng, bỏ qua LLM", transcript_version_id)
            return AnalysisResult(run_id=str(uuid.uuid4()), model="none")

        messages = build_messages(segments, language, template_sections)
        models = [m for m in (self.settings.model, self.settings.fallback_model) if m]
        errors: list[str] = []
        async with httpx.AsyncClient(
            base_url=self.settings.base_url,
            headers={"Authorization": f"Bearer {self.settings.api_key}"},
            # Thời gian chờ giữa hai mẩu dữ liệu; tổng thời gian giới hạn bằng timeout_s.
            timeout=httpx.Timeout(180.0, connect=15.0),
            transport=self._transport,
        ) as client:
            for model in models:
                try:
                    content = await self._complete(client, model, messages)
                    result = normalize(parse_json(content), segments, template_sections)
                except (httpx.HTTPError, LlmError, asyncio.TimeoutError) as err:
                    reason = str(err) or type(err).__name__
                    log.warning("Model %s không dùng được cho %s: %s", model, meeting_id, reason)
                    errors.append(f"{model}: {reason}")
                    continue
                log.info(
                    "LLM %s: %d công việc, %d quyết định, %d vấn đề mở",
                    model,
                    len(result["action_items"]),
                    len(result["decisions"]),
                    len(result["open_issues"]),
                )
                return AnalysisResult(run_id=str(uuid.uuid4()), model=model, **result)
        raise LlmError("; ".join(errors))

    async def _complete(self, client: httpx.AsyncClient, model: str, messages: list[dict[str, str]]) -> str:
        # Truyền luồng: mô hình suy luận có thể nghĩ hơn một phút trước khi ra
        # chữ đầu tiên; gọi thường thì cổng dịch vụ trả 524 (hết giờ chờ), còn
        # luồng thì token suy luận chảy về liên tục nên kết nối không bị cắt.
        body = {
            "model": model,
            "messages": messages,
            "temperature": self.settings.temperature,
            "max_tokens": self.settings.max_tokens,
            "stream": True,
        }
        return await asyncio.wait_for(self._stream(client, body), timeout=self.settings.timeout_s)

    async def _stream(self, client: httpx.AsyncClient, body: dict[str, Any]) -> str:
        return await stream_completion(client, body)


async def stream_completion(client: httpx.AsyncClient, body: dict[str, Any]) -> str:
    """Gọi /chat/completions theo luồng, ghép phần nội dung (bỏ phần suy luận).

    Dùng chung cho phân tích biên bản và hỏi đáp (knowledge_qa.py).
    """
    parts: list[str] = []
    finish = None
    async with client.stream("POST", "/chat/completions", json=body) as response:
        if response.status_code != 200:
            # Thân lỗi của gateway (402 hết tiền, 404 sai tên model…) giúp biết sửa gì.
            text = (await response.aread()).decode("utf-8", "replace")
            raise LlmError(f"HTTP {response.status_code}: {text[:300]}")
        if "json" in response.headers.get("content-type", ""):
            # Gateway bỏ qua stream và trả một cục JSON như gọi thường.
            choice = (json.loads(await response.aread()).get("choices") or [{}])[0]
            parts.append((choice.get("message") or {}).get("content") or "")
            finish = choice.get("finish_reason")
        else:
            async for line in response.aiter_lines():
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                data = line[len("data:") :].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except ValueError:
                    continue
                if chunk.get("error"):
                    raise LlmError(f"lỗi giữa luồng: {str(chunk['error'])[:300]}")
                for choice in chunk.get("choices") or []:
                    # Bỏ reasoning_content: chỉ phần nội dung mới là JSON kết quả.
                    content = (choice.get("delta") or {}).get("content")
                    if content:
                        parts.append(content)
                    if choice.get("finish_reason"):
                        finish = choice["finish_reason"]
    if finish == "length":
        raise LlmError("hết max_tokens trước khi trả xong JSON")
    return "".join(parts)
