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

Hội thoại (chat): ngữ cảnh lượt trước đọc từ ai.chat_messages theo threadId
(knowledge_threads.py), không nhận từ client; hỏi xong lưu cả câu hỏi lẫn câu
trả lời đã đánh lại số, kể cả khi trả "chưa đủ thông tin". Câu hỏi nối tiếp
("hạn của người đó?") được viết lại thành câu đủ nghĩa ("hạn của Hùng?")
trước khi tìm và trả lời: đại từ không tìm ra đoạn nào, còn model trả lời
thì bám chữ, hỏi mơ hồ là từ chối.
"""

import asyncio
import logging
import os
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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
from app.worker.knowledge_threads import (
    HISTORY_MESSAGES,
    ThreadNotFound,
    ThreadStore,
    new_id,
    thread_title,
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

REWRITE_PROMPT = """Bạn chuẩn bị câu hỏi để tra cứu nội dung các cuộc họp. Cho đoạn HỘI THOẠI trước và CÂU HỎI MỚI, hãy viết lại CÂU HỎI MỚI thành câu hỏi đủ nghĩa khi đứng một mình:
- Đại từ, từ chỉ trỏ ("người đó", "anh ấy", "việc đó", "hôm đó"…) thì thay bằng đúng tên người, tên việc, thời điểm mà nó trỏ tới trong hội thoại. Chỉ thay đúng chỗ đó, không thêm chi tiết nào khác vào câu hỏi.
- Câu hỏi mới bị lược ý ("còn thanh toán thì sao?") thì bổ sung phần bị lược theo hội thoại.
- Không trả lời câu hỏi, không thêm thông tin mà hội thoại không có.
- Câu hỏi mới đã đủ nghĩa hoặc chuyển sang chủ đề khác thì giữ nguyên.
- Giữ ngôn ngữ của câu hỏi mới.

Chỉ trả về một object JSON: {"question": "câu hỏi đã viết lại"}"""

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
    # Viết lại câu hỏi nối tiếp: việc nhỏ, dùng model nhanh; để trống thì tắt
    # (lùi về ghép lượt hỏi đáp trước vào câu tìm kiếm).
    rewrite_model: str = "GLM-5.2"
    rewrite_timeout_s: float = 15.0

    @classmethod
    def from_env(cls) -> "QaSettings":
        env = os.environ.get
        return cls(
            base_url=env("AI_LLM_BASE_URL", cls.base_url).rstrip("/"),
            api_key=env("AI_LLM_API_KEY", cls.api_key),
            rerank_model=env("AI_RERANK_MODEL", cls.rerank_model),
            model=env("AI_QA_MODEL", cls.model),
            fallback_model=env("AI_QA_FALLBACK_MODEL", cls.fallback_model),
            rewrite_model=env("AI_QA_REWRITE_MODEL", env("AI_QA_MODEL", cls.rewrite_model)),
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


def history_turns(messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Tin đã lưu → lượt hội thoại cho model.

    Câu trả lời dạng danh sách có câu dẫn rất ngắn, nội dung nằm ở "list"; bỏ
    list đi thì câu hỏi nối tiếp ("hạn của việc thứ hai?") mất chỗ dựa.
    """
    turns = []
    for message in messages:
        content = str(message.get("content") or "")
        items = message.get("list") or []
        if items:
            content = "\n".join([content, *(f"- {item}" for item in items)])
        turns.append({"role": message.get("role"), "content": content})
    return turns


def retrieval_query(question: str, history: list[dict[str, str]] | None) -> str:
    """Câu hỏi nối tiếp ("ai làm việc đó?") thiếu chủ ngữ; ghép lượt hỏi đáp trước để tìm đúng chủ đề.

    Ghép cả câu trả lời trước: đại từ ("hạn của người đó?") trỏ tới thứ câu
    TRẢ LỜI nêu ra (Hùng), câu hỏi trước không có tên đó nên tìm không ra.
    """
    previous_question = previous_answer = ""
    for turn in history or []:
        content = str(turn.get("content") or "").strip()
        if not content:
            continue
        if turn.get("role") == "user":
            previous_question, previous_answer = content, ""
        elif turn.get("role") == "assistant" and previous_question:
            previous_answer = content
    if not previous_question:
        return question
    parts = [previous_question[:500]]
    # Câu từ chối không chứa thông tin gì, ghép vào chỉ làm lệch kết quả tìm.
    if previous_answer and not _norm(previous_answer).startswith(_norm(INSUFFICIENT_ANSWER)[:30]):
        parts.append(_CITE_WITH_SPACE_RE.sub("", previous_answer)[:500])
    return "\n".join([*parts, question])


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


def build_rewrite_messages(question: str, history: list[dict[str, str]]) -> list[dict[str, str]]:
    lines = []
    for turn in history:
        # Bỏ [n]: số trích dẫn vô nghĩa với bước viết lại, model dễ chép theo.
        content = _CITE_WITH_SPACE_RE.sub("", str(turn.get("content") or "")).strip()[:500]
        if turn.get("role") in ("user", "assistant") and content:
            lines.append(f"{'Người hỏi' if turn['role'] == 'user' else 'Trợ lý'}: {content}")
    conversation = "\n".join(lines)
    return [
        {"role": "system", "content": REWRITE_PROMPT},
        {"role": "user", "content": f"HỘI THOẠI:\n{conversation}\n\nCÂU HỎI MỚI: {question}"},
    ]


def parse_rewrite(raw: dict[str, Any], question: str) -> str | None:
    value = " ".join(_string(raw.get("question")).split())
    # Dài bất thường thường là model trả lời luôn thay vì viết lại câu hỏi.
    if not value or len(value) > max(300, 3 * len(question)):
        return None
    return value


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


# Câu mở đầu bằng các cụm này đang sửa lại câu ngay trước nó.
CORRECTION_RE = re.compile(r"^(à|á|ơ|ờ)?\s*(không|nhầm|à nhầm|sửa lại|thôi|ý (em|anh|chị|tôi) là)\b", re.IGNORECASE)


def _quote_candidates(text: str) -> list[str]:
    """Các câu của một dòng, cộng thêm cặp "câu + câu đính chính ngay sau".

    "Chắc ngày 15 xong. À không, ngày 18 đi chị." — trích riêng câu đầu thì
    sai ý, trích riêng câu sau thì thiếu ngữ cảnh; trích cả cặp mới trung thực.
    """
    sentences = _sentences(text) or [text]
    out = list(sentences)
    for first, second in zip(sentences, sentences[1:]):
        if CORRECTION_RE.match(unicodedata.normalize("NFC", second).strip()):
            out.append(first + " " + second)
    return out


def _claims(text: str) -> list[str]:
    """Câu của câu trả lời, dấu [n] đứng sau dấu chấm ("… 18/11. [1]") gộp về câu trước nó.

    Không gộp thì [1] thành "câu" rỗng chữ, câu trích không được chấm theo
    nội dung câu trả lời nữa.
    """
    claims: list[str] = []
    for sentence in _sentences(text):
        if claims and not CITE_RE.sub("", sentence).strip():
            claims[-1] += " " + sentence
        else:
            claims.append(sentence)
    return claims


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
        for sentence in _quote_candidates(text):
            found = terms(sentence)
            score = 2 * len(found & question_terms) + len(found & answer_terms)
            # Con số quyết định đúng sai ("ngày 18" hay "ngày 15"): số có trong câu
            # trả lời được cộng nặng, số lạ bị trừ, để không trích câu trước khi
            # người nói đính chính.
            numbers = {t for t in found if t.isdigit()}
            answer_numbers = {t for t in answer_terms if t.isdigit()}
            if answer_numbers:
                score += 3 * len(numbers & answer_numbers) - 2 * len(numbers - answer_numbers)
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
    sentences = _claims(answer) + items
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
        threads: ThreadStore | None = None,
    ) -> None:
        self.settings = settings or QaSettings.from_env()
        self._search = search or knowledge_store.search
        self._list_sources = list_sources or knowledge_store.list_sources
        self._transport = transport
        self._embedder = embedder or EmbeddingClient(transport=transport)
        self._threads = threads or ThreadStore()

    async def chat(
        self,
        workspace_id: str,
        user_id: str,
        question: str,
        meeting_ids: list[str] | None,
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        """Hỏi trong một hội thoại: kiểm chủ → đọc ngữ cảnh từ DB → trả lời → lưu lượt hỏi đáp.

        Hội thoại mới chỉ được ghi cùng lúc với câu trả lời: model lỗi thì
        không để lại hội thoại rỗng trong danh sách.
        """
        question = question.strip()
        asked_at = datetime.now(timezone.utc)
        create = not thread_id
        if create:
            thread_id, history = new_id(), []
        else:
            thread = await asyncio.to_thread(self._threads.find, workspace_id, user_id, thread_id)
            if thread is None:
                raise ThreadNotFound(thread_id)
            stored = await asyncio.to_thread(self._threads.recent_messages, workspace_id, thread_id, HISTORY_MESSAGES)
            history = history_turns(stored)

        result = await self.ask(workspace_id, question, meeting_ids, history)

        # Hai tin ghi cùng transaction; mốc riêng (trả lời sau hỏi ít nhất 1µs)
        # để đọc lại luôn đúng thứ tự hỏi → đáp.
        answered_at = max(datetime.now(timezone.utc), asked_at + timedelta(microseconds=1))
        answer_id = new_id()
        messages = [
            {"id": new_id(), "role": "user", "content": question, "created_at": asked_at},
            {
                "id": answer_id,
                "role": "assistant",
                "content": result["answer"],
                "list": result.get("list"),
                "citations": result["citations"],
                "insufficient_evidence": result["insufficient"],
                "model": result["model"],
                "created_at": answered_at,
            },
        ]
        await asyncio.to_thread(
            lambda: self._threads.save_turn(
                workspace_id=workspace_id,
                user_id=user_id,
                thread_id=thread_id,
                create=create,
                title=thread_title(question) if create else None,
                messages=messages,
                at=answered_at,
            )
        )
        return {**result, "threadId": thread_id, "messageId": answer_id}

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
        async with httpx.AsyncClient(
            base_url=s.base_url,
            headers={"Authorization": f"Bearer {s.api_key}"},
            timeout=httpx.Timeout(s.timeout_s, connect=10.0),
            transport=self._transport,
        ) as client:
            standalone = await self._standalone(client, question, history) if history else None
            # Viết lại hỏng thì vẫn trả lời được: tìm bằng câu ghép lượt trước,
            # model đọc câu gốc cùng lịch sử.
            asked = standalone or question
            query = standalone or retrieval_query(question, history)
            t_rewrite = time.perf_counter()
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
            scores = await self._rerank(client, query, rows)
            t_rerank = time.perf_counter()
            sources = select_sources(rows, scores, s.keep, s.relevance_floor, s.min_keep)
            raw, model = await self._answer(client, build_qa_messages(asked, sources, history))
        result = finalize(raw, sources, asked, model)
        done = time.perf_counter()
        log.info(
            "Hỏi đáp ws=%s: %d cuộc họp, %d ứng viên, giữ %d, model %s, %s, %d trích dẫn, %.2fs "
            "(viết lại %s %.2f, nhúng %.2f, tìm %.2f, xếp hạng %.2f, trả lời %.2f)",
            workspace_id,
            len(meeting_ids),
            len(rows),
            len(sources),
            model,
            "thiếu thông tin" if result["insufficient"] else "có câu trả lời",
            len(result["citations"]),
            done - started,
            "có" if standalone and standalone != question else "không",
            t_rewrite - started,
            t_embed - t_rewrite,
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

    async def _standalone(self, client: httpx.AsyncClient, question: str, history: list[dict[str, str]]) -> str | None:
        """Câu hỏi nối tiếp → câu đủ nghĩa; None nếu tắt hoặc lỗi (bên gọi lùi về cách cũ)."""
        if not self.settings.rewrite_model:
            return None
        body = {
            "model": self.settings.rewrite_model,
            "messages": build_rewrite_messages(question, history),
            "temperature": 0.0,
            "max_tokens": 1024,
            "stream": True,
        }
        try:
            content = await asyncio.wait_for(stream_completion(client, body), timeout=self.settings.rewrite_timeout_s)
            return parse_rewrite(parse_json(content), question)
        except (httpx.HTTPError, LlmError, asyncio.TimeoutError) as err:
            log.warning("Viết lại câu hỏi nối tiếp lỗi, tìm bằng câu ghép lượt trước: %s", str(err) or type(err).__name__)
            return None

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
