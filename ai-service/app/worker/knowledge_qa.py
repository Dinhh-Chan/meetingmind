"""Hỏi đáp trên tri thức cuộc họp (RAG): tìm đoạn → xếp hạng lại → LLM trả lời có trích dẫn.

Quyền xem (§6.12): Core gửi kèm danh sách meetingIds người hỏi được xem. Bộ
lọc nằm trong câu SQL tìm kiếm (knowledge_store.build_search), nên đoạn của
cuộc họp ngoài quyền không bao giờ được đọc ra, càng không tới model. Danh
sách rỗng thì trả "chưa đủ thông tin" ngay, không gọi gì cả.

Các bước, đều qua FPT AI Factory (dữ liệu không ra ngoài FPT):
1. Nhúng câu hỏi (Vietnamese_Embedding), lấy 24 đoạn gần nhất theo cosine.
2. Xếp hạng lại bằng bge-reranker-v2-m3: vector chỉ đo "cùng chủ đề", còn
   reranker đọc cả câu hỏi lẫn đoạn nên phân biệt được đoạn thật sự trả lời.
   Giữ tối đa 6 đoạn trên ngưỡng; reranker lỗi thì giữ thứ tự vector.
3. LLM trả lời chỉ từ các nguồn đánh số. GLM-5.2 trả lời trong vài giây, hợp
   với người đang chờ; DeepSeek-V4.1-Flash chậm hơn nhiều (có bước suy luận)
   nên chỉ làm dự phòng.

Model hay đánh số trích dẫn lộn xộn ([3] rồi [1], trích nguồn không có), nên
phía này tự đánh lại 1..k theo thứ tự xuất hiện và tự chọn câu trích từ đoạn
nguồn, không tin câu trích model chép lại.
"""

import asyncio
import logging
import os
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Any, Callable

import httpx

from app.worker import knowledge_store
from app.worker.embeddings import EmbeddingClient
from app.worker.knowledge_chunker import (
    SOURCE_LABELS,
    chunk_header,
    embed_text,
    fmt_ts,
    parse_line,
)
from app.worker.llm_analyzer import LlmError, parse_json, stream_completion

log = logging.getLogger("app.knowledge")

INSUFFICIENT_ANSWER = "Chưa đủ thông tin trong các cuộc họp bạn được xem để trả lời câu hỏi này."
QUOTE_MAX_CHARS = 220

SYSTEM_PROMPT = """Bạn là trợ lý tra cứu nội dung các cuộc họp của nhóm. Bạn chỉ được trả lời dựa trên các NGUỒN được đánh số [1], [2]… trong tin nhắn của người dùng (trích từ transcript, biên bản, quyết định, công việc, tài liệu của các cuộc họp người hỏi được xem).

Quy tắc:
- Chỉ dùng thông tin có trong nguồn. Không dùng kiến thức bên ngoài, không suy đoán, không bịa tên, ngày, con số.
- Mỗi câu nêu thông tin phải có dấu trích dẫn [n] ngay cuối câu, n là số của nguồn chứa thông tin đó. Nhiều nguồn thì viết [1][3].
- Phân biệt rõ điều đã CHỐT (quyết định, cả nhóm đồng ý) với điều chỉ là ĐỀ XUẤT hay ý kiến chưa ai đồng ý ("hay là…", "em nghĩ…"). Nếu nguồn chỉ có đề xuất thì nói rõ đó là đề xuất.
- Nếu sau đó có người đính chính (đổi hạn, đổi người làm, huỷ việc) thì nêu thông tin cuối cùng.
- Transcript do máy nhận dạng giọng nói nên có thể sai chính tả vài chỗ; dòng transcript có dạng "[phút:giây] Người nói: lời nói".
- Nếu các nguồn không chứa câu trả lời (kể cả câu hỏi không liên quan đến cuộc họp) thì đặt "insufficient": true và "answer" đúng nguyên văn: "{insufficient}"
- Trả lời ngắn gọn, đi thẳng vào ý, bằng tiếng Việt (hoặc bằng ngôn ngữ của câu hỏi nếu câu hỏi không phải tiếng Việt).
- Khi câu trả lời gồm nhiều mục (danh sách công việc, các quyết định…), đặt các mục vào "list", mỗi mục là một chuỗi ngắn cũng có [n]; khi đó "answer" là một câu dẫn ngắn. Không có nhiều mục thì bỏ "list".

Chỉ trả về một object JSON, không kèm giải thích:
{{"answer": "câu trả lời có [n]", "list": ["mục có [n]"], "citations": [1], "insufficient": false}}"""

# Từ chức năng hay gặp: không giúp chọn câu trích nào sát câu hỏi hơn.
STOPWORDS = frozenset(
    """là và của có không được cho với thì mà này đó kia gì nào các những một hai
    ai ở trong trên dưới về để khi nếu đã đang sẽ rồi cũng như nhưng hay hoặc vì
    em anh chị mình bạn tôi chúng ta nhé nha ạ à ừ ok vậy thế sao bao giờ nhiều
    the a an of to in on and or is are was what who when which""".split()
)

# [1], [1, 3], [1;3], [nguồn 2] → nhóm số trích dẫn.
CITE_RE = re.compile(r"\[\s*(?:nguồn\s*)?(\d{1,2}(?:\s*[,;]\s*(?:nguồn\s*)?\d{1,2})*)\s*\]", re.IGNORECASE)
_CITE_WITH_SPACE_RE = re.compile(r"\s*" + CITE_RE.pattern, re.IGNORECASE)
_DROPPED = "\x00"


class KnowledgeError(Exception):
    """Không trả lời được vì dịch vụ phụ thuộc lỗi (nhúng, model)."""


@dataclass(frozen=True)
class QaSettings:
    base_url: str = "https://token-api.fpt.ai/v1"
    api_key: str = ""
    rerank_model: str = "bge-reranker-v2-m3"
    model: str = "GLM-5.2"
    fallback_model: str = "DeepSeek-V4.1-Flash"
    candidates: int = 24
    keep: int = 6
    # Điểm bge-reranker đã qua sigmoid: đoạn đúng ý thường > 0.3, đoạn lạc đề
    # ~0.0001. Ngưỡng thấp để không bỏ sót đoạn diễn đạt khác câu hỏi.
    relevance_floor: float = 0.02
    # Không đoạn nào qua ngưỡng: vẫn đưa vài đoạn tốt nhất để model tự kết
    # luận "chưa đủ thông tin", tránh từ chối oan câu hỏi diễn đạt lạ.
    min_keep: int = 3
    max_tokens: int = 8192
    temperature: float = 0.1
    timeout_s: float = 60.0
    rerank_timeout_s: float = 20.0

    @classmethod
    def from_env(cls) -> "QaSettings":
        env = os.environ.get
        return cls(
            base_url=env("AI_LLM_BASE_URL", cls.base_url).rstrip("/"),
            api_key=env("AI_LLM_API_KEY", cls.api_key),
            rerank_model=env("AI_RERANK_MODEL", cls.rerank_model),
            model=env("AI_QA_MODEL", cls.model),
            fallback_model=env("AI_QA_FALLBACK_MODEL", cls.fallback_model),
            relevance_floor=float(env("AI_QA_RELEVANCE_FLOOR", str(cls.relevance_floor))),
            timeout_s=float(env("AI_QA_TIMEOUT_S", str(cls.timeout_s))),
        )


# ---------- Hàm thuần: test được không cần mạng ----------


def _norm(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", str(text or "")).lower().split())


def terms(text: str) -> set[str]:
    return {t for t in re.findall(r"\w+", _norm(text)) if t not in STOPWORDS and len(t) > 1}


def insufficient(model: str) -> dict[str, Any]:
    return {"answer": INSUFFICIENT_ANSWER, "insufficient": True, "model": model, "citations": []}


def retrieval_query(question: str, history: list[dict[str, str]] | None) -> str:
    """Câu hỏi nối tiếp ("ai làm việc đó?") thiếu chủ ngữ; ghép câu hỏi trước để tìm đúng chủ đề."""
    previous = [h.get("content", "") for h in history or [] if h.get("role") == "user" and str(h.get("content", "")).strip()]
    if previous:
        return f"{previous[-1][:500]}\n{question}"
    return question


def select_sources(
    rows: list[dict[str, Any]],
    scores: list[float] | None,
    keep: int = 6,
    floor: float = 0.02,
    min_keep: int = 3,
) -> list[dict[str, Any]]:
    if scores is None:
        return rows[:keep]
    # sorted ổn định: điểm bằng nhau thì giữ thứ tự vector.
    ranked = sorted(range(len(rows)), key=lambda i: scores[i], reverse=True)
    chosen = [i for i in ranked if scores[i] >= floor][:keep]
    if not chosen:
        chosen = ranked[:min_keep]
    return [{**rows[i], "score": scores[i]} for i in chosen]


def _row_title(row: dict[str, Any]) -> str | None:
    meta = row.get("metadata") or {}
    if row.get("source_type") == "document":
        return meta.get("fileName") or meta.get("sourceTitle")
    return meta.get("title")


def row_header(row: dict[str, Any]) -> str:
    return chunk_header(row.get("meeting_title") or "Cuộc họp", row.get("source_type") or "", _row_title(row))


def source_block(n: int, row: dict[str, Any]) -> str:
    meta = row.get("metadata") or {}
    label = SOURCE_LABELS.get(row.get("source_type"), row.get("source_type"))
    title = _row_title(row)
    parts = [f'Cuộc họp "{row.get("meeting_title") or "không tên"}"']
    if meta.get("meetingDate"):
        parts.append(f"ngày {str(meta['meetingDate'])[:10]}")
    parts.append(f"{label} — {title}" if title and title != label else label)
    if row.get("start_ms") is not None:
        span = fmt_ts(row["start_ms"])
        if row.get("end_ms") is not None:
            span += f"–{fmt_ts(row['end_ms'])}"
        parts.append(span)
    return f"[{n}] " + " · ".join(parts) + "\n" + row.get("content", "")


def build_qa_messages(
    question: str,
    sources: list[dict[str, Any]],
    history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(insufficient=INSUFFICIENT_ANSWER)}]
    for turn in history or []:
        content = str(turn.get("content") or "").strip()
        if turn.get("role") not in ("user", "assistant") or not content:
            continue
        # Số [n] của câu trả lời cũ trỏ tới bộ nguồn cũ; giữ lại sẽ làm model
        # trích nhầm sang nguồn mới cùng số.
        content = _CITE_WITH_SPACE_RE.sub("", content)[:2000]
        messages.append({"role": turn["role"], "content": content})
    blocks = "\n\n".join(source_block(i, row) for i, row in enumerate(sources, 1))
    messages.append({"role": "user", "content": f"NGUỒN:\n\n{blocks}\n\nCÂU HỎI: {question}"})
    return messages


def _numbers(group: str) -> list[int]:
    return [int(x) for x in re.findall(r"\d{1,2}", group)]


def renumber(answer: str, items: list[str], k: int) -> tuple[str, list[str], list[int]]:
    """Đánh lại số trích dẫn 1..m theo thứ tự xuất hiện, bỏ số trỏ ra ngoài k nguồn.

    Trả (answer, items đã viết lại, order) với order[j-1] = số cũ của trích dẫn mới j.
    """
    order: list[int] = []
    for text in (answer, *items):
        for match in CITE_RE.finditer(text):
            for n in _numbers(match.group(1)):
                if 1 <= n <= k and n not in order:
                    order.append(n)
    mapping = {old: new for new, old in enumerate(order, 1)}

    def sub(match: re.Match) -> str:
        kept: list[int] = []
        for n in _numbers(match.group(1)):
            if n in mapping and mapping[n] not in kept:
                kept.append(mapping[n])
        return "".join(f"[{n}]" for n in kept) or _DROPPED

    def rewrite(text: str) -> str:
        text = CITE_RE.sub(sub, text)
        text = re.sub(r"\s*" + _DROPPED, "", text)
        text = re.sub(r"(\[\d+\])(?:\s*\1)+", r"\1", text)
        return re.sub(r"[ \t]{2,}", " ", text).strip()

    return rewrite(answer), [rewrite(x) for x in items], order


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?…])\s+", text) if s.strip()]


def _clip(text: str, wanted: set[str], limit: int = QUOTE_MAX_CHARS) -> str:
    """Cắt ≤ limit ký tự quanh chỗ khớp đầu tiên, ở ranh giới từ."""
    if len(text) <= limit:
        return text
    lowered = unicodedata.normalize("NFC", text).lower()
    hits = [p for p in (lowered.find(t) for t in wanted) if p >= 0]
    start = max(0, min(hits) - 60) if hits else 0
    if start:
        space = text.find(" ", start)
        start = space + 1 if 0 <= space < start + 30 else start
    end = start + limit - (2 if start else 1)
    piece = text[start:end]
    if end < len(text) and " " in piece:
        piece = piece[: piece.rfind(" ")]
    return ("…" if start else "") + piece.strip() + ("…" if end < len(text) else "")


def best_quote(
    row: dict[str, Any],
    question_terms: set[str],
    answer_terms: set[str] | frozenset[str] = frozenset(),
) -> tuple[str, int | None, str | None]:
    """Câu trích sát ý nhất trong đoạn nguồn → (quote, startMs, người nói).

    Chấm theo từ của câu hỏi (nặng gấp đôi) và từ của câu trả lời trích nguồn
    này: câu trả lời nêu đúng chữ cần tìm ("PostgreSQL") mà câu hỏi không có.
    Với transcript, mốc thời gian và người nói lấy theo đúng dòng chứa câu
    trích chứ không theo đầu đoạn, để bấm vào là nghe đúng chỗ.
    """
    meta = row.get("metadata") or {}
    line_starts = meta.get("lineStartMs") or []
    is_transcript = row.get("source_type") == "transcript"

    best: tuple[int, str, int | None, str | None] | None = None  # (điểm, câu, ms, người nói)
    for index, line in enumerate(str(row.get("content") or "").split("\n")):
        if not line.strip():
            continue
        start_ms, speaker, text = None, None, line.strip()
        if is_transcript:
            parsed_start, speaker, text = parse_line(line)
            exact = line_starts[index] if index < len(line_starts) else None
            start_ms = exact if exact is not None else parsed_start
        for sentence in _sentences(text) or [text]:
            found = terms(sentence)
            score = 2 * len(found & question_terms) + len(found & answer_terms)
            # Điểm bằng nhau thì giữ câu đứng trước.
            if best is None or score > best[0]:
                best = (score, sentence, start_ms, speaker)
    if best is None:
        return "", row.get("start_ms"), meta.get("speaker")
    _, sentence, start_ms, speaker = best
    if start_ms is None:
        start_ms = row.get("start_ms")
    return _clip(sentence, question_terms | answer_terms), start_ms, speaker or meta.get("speaker")


def _string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        value = value.get("text") or value.get("content") or ""
    return str(value).strip()


def _flag(value: Any) -> bool:
    return value is True or str(value).strip().lower() in ("true", "1", "yes")


def finalize(raw: dict[str, Any], sources: list[dict[str, Any]], question: str, model: str) -> dict[str, Any]:
    """Đưa JSON của model về đúng hợp đồng /internal/knowledge/ask."""
    answer = _string(raw.get("answer"))
    items_raw = raw.get("list")
    items = [_string(x).lstrip("-•* ").strip() for x in items_raw] if isinstance(items_raw, list) else []
    items = [x for x in items if x]
    if (
        _flag(raw.get("insufficient"))
        or (not answer and not items)
        or _norm(answer).startswith(_norm(INSUFFICIENT_ANSWER)[:30])
    ):
        return insufficient(model)

    answer, items, order = renumber(answer, items, len(sources))
    if not order:
        # Model quên gắn [n] trong câu nhưng có khai danh sách nguồn: gắn cuối câu trả lời.
        for value in raw.get("citations") or []:
            try:
                n = int(value)
            except (TypeError, ValueError):
                continue
            if 1 <= n <= len(sources) and n not in order:
                order.append(n)
        if order:
            answer = f"{answer} " + "".join(f"[{i}]" for i in range(1, len(order) + 1))
        else:
            log.warning("Câu trả lời không có trích dẫn nào (model %s)", model)

    question_terms = terms(question)
    sentences = _sentences(answer) + items
    citations = []
    for new_n, old_n in enumerate(order, 1):
        row = sources[old_n - 1]
        marker = f"[{new_n}]"
        answer_terms = set().union(*(terms(s) for s in sentences if marker in s))
        quote, start_ms, speaker = best_quote(row, question_terms, answer_terms)
        citation: dict[str, Any] = {
            "n": new_n,
            "meetingId": row.get("meeting_id"),
            "meetingTitle": row.get("meeting_title"),
            "sourceType": row.get("source_type"),
            "sourceId": row.get("source_id"),
            "quote": quote,
        }
        if start_ms is not None:
            citation["startMs"] = int(start_ms)
        if speaker:
            citation["speaker"] = speaker
        citations.append(citation)

    result: dict[str, Any] = {"answer": answer, "insufficient": False, "model": model, "citations": citations}
    if items:
        result["list"] = items
    return result


def source_summary(row: dict[str, Any]) -> dict[str, Any]:
    title = row.get("title") or SOURCE_LABELS.get(row.get("source_type"), row.get("source_type"))
    indexed_at = row.get("indexed_at")
    return {
        "meetingId": row.get("meeting_id"),
        "meetingTitle": row.get("meeting_title"),
        "sourceType": row.get("source_type"),
        "sourceId": row.get("source_id"),
        "title": title,
        "chunks": int(row.get("chunks") or 0),
        "indexedAt": indexed_at.isoformat() if hasattr(indexed_at, "isoformat") else indexed_at,
    }


# ---------- Gọi dịch vụ ----------


def _clean_ids(meeting_ids: list[str] | None) -> list[str]:
    seen: list[str] = []
    for value in meeting_ids or []:
        value = str(value or "").strip()
        if value and value not in seen:
            seen.append(value)
    return seen


class KnowledgeQA:
    def __init__(
        self,
        settings: QaSettings | None = None,
        search: Callable[..., list[dict[str, Any]]] | None = None,
        list_sources: Callable[..., list[dict[str, Any]]] | None = None,
        embedder: EmbeddingClient | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings or QaSettings.from_env()
        self._search = search or knowledge_store.search
        self._list_sources = list_sources or knowledge_store.list_sources
        self._transport = transport
        self._embedder = embedder or EmbeddingClient(transport=transport)

    async def ask(
        self,
        workspace_id: str,
        question: str,
        meeting_ids: list[str] | None,
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        meeting_ids = _clean_ids(meeting_ids)
        question = question.strip()
        if not meeting_ids or not question:
            # Người hỏi không được xem cuộc họp nào: khỏi tìm, khỏi gọi model.
            return insufficient("none")

        s = self.settings
        started = time.perf_counter()
        query = retrieval_query(question, history)
        try:
            vector = (await self._embedder.embed([query]))[0]
        except Exception as err:  # noqa: BLE001
            raise KnowledgeError(f"nhúng câu hỏi lỗi: {err}") from None
        t_embed = time.perf_counter()
        rows = await asyncio.to_thread(self._search, workspace_id, meeting_ids, vector, s.candidates)
        t_search = time.perf_counter()
        if not rows:
            log.info("Hỏi đáp ws=%s: %d cuộc họp, chưa có đoạn nào được lập chỉ mục", workspace_id, len(meeting_ids))
            return insufficient("none")

        async with httpx.AsyncClient(
            base_url=s.base_url,
            headers={"Authorization": f"Bearer {s.api_key}"},
            timeout=httpx.Timeout(s.timeout_s, connect=10.0),
            transport=self._transport,
        ) as client:
            scores = await self._rerank(client, query, rows)
            t_rerank = time.perf_counter()
            sources = select_sources(rows, scores, s.keep, s.relevance_floor, s.min_keep)
            raw, model = await self._answer(client, build_qa_messages(question, sources, history))
        result = finalize(raw, sources, question, model)
        done = time.perf_counter()
        log.info(
            "Hỏi đáp ws=%s: %d cuộc họp, %d ứng viên, giữ %d, model %s, %s, %d trích dẫn, %.2fs "
            "(nhúng %.2f, tìm %.2f, xếp hạng %.2f, trả lời %.2f)",
            workspace_id,
            len(meeting_ids),
            len(rows),
            len(sources),
            model,
            "thiếu thông tin" if result["insufficient"] else "có câu trả lời",
            len(result["citations"]),
            done - started,
            t_embed - started,
            t_search - t_embed,
            t_rerank - t_search,
            done - t_rerank,
        )
        return result

    async def sources(self, workspace_id: str, meeting_ids: list[str] | None) -> list[dict[str, Any]]:
        meeting_ids = _clean_ids(meeting_ids)
        if not meeting_ids:
            return []
        rows = await asyncio.to_thread(self._list_sources, workspace_id, meeting_ids)
        return [source_summary(r) for r in rows]

    async def _rerank(self, client: httpx.AsyncClient, query: str, rows: list[dict[str, Any]]) -> list[float] | None:
        """Điểm liên quan theo đúng thứ tự rows; None nếu lỗi (bên gọi giữ thứ tự vector)."""
        if not self.settings.rerank_model or len(rows) < 2:
            return None
        documents = [embed_text(row_header(r), r.get("content", ""))[:2000] for r in rows]
        try:
            response = await client.post(
                "/rerank",
                json={"model": self.settings.rerank_model, "query": query, "documents": documents},
                timeout=self.settings.rerank_timeout_s,
            )
            if response.status_code != 200:
                raise ValueError(f"HTTP {response.status_code}: {response.text[:200]}")
            scores: list[float | None] = [None] * len(rows)
            for item in response.json()["results"]:
                scores[int(item["index"])] = float(item["relevance_score"])
            if any(x is None for x in scores):
                raise ValueError("thiếu điểm cho một số đoạn")
            return scores  # type: ignore[return-value]
        except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as err:
            log.warning("Xếp hạng lại lỗi, dùng thứ tự vector: %s", str(err) or type(err).__name__)
            return None

    async def _answer(self, client: httpx.AsyncClient, messages: list[dict[str, str]]) -> tuple[dict[str, Any], str]:
        errors: list[str] = []
        for model in [m for m in (self.settings.model, self.settings.fallback_model) if m]:
            body = {
                "model": model,
                "messages": messages,
                "temperature": self.settings.temperature,
                "max_tokens": self.settings.max_tokens,
                "stream": True,
            }
            try:
                content = await asyncio.wait_for(stream_completion(client, body), timeout=self.settings.timeout_s)
                return parse_json(content), model
            except (httpx.HTTPError, LlmError, asyncio.TimeoutError) as err:
                reason = str(err) or type(err).__name__
                log.warning("Model hỏi đáp %s không dùng được: %s", model, reason)
                errors.append(f"{model}: {reason}")
        raise KnowledgeError("; ".join(errors))
