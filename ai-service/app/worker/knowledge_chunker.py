"""Cắt nguồn tri thức của cuộc họp thành đoạn (chunk) để nhúng vector và trích dẫn.

Mỗi đoạn giữ hai bản:
- content: nội dung sạch, dùng để trích dẫn cho người đọc.
- chữ đem nhúng = đầu mục (tên cuộc họp + loại nguồn) + content. Câu hỏi hay
  nhắc tên cuộc họp ("họp sprint 3 chốt gì?") mà lời nói trong transcript thì
  không, nên đầu mục giúp tìm đúng đoạn hơn.

Kích thước ~500–900 ký tự: đủ ngữ cảnh cho một ý, đủ nhỏ để 6 đoạn vừa prompt
và câu trích còn sát ý. Transcript không bao giờ cắt giữa một lượt nói, vì
trích dẫn trỏ về đúng một lượt nói (startMs, người nói).
"""

import re
from dataclasses import dataclass, field
from typing import Any

SOURCE_TYPES = ("transcript", "minutes", "decision", "action_item", "document")

SOURCE_LABELS = {
    "transcript": "Transcript",
    "minutes": "Biên bản",
    "decision": "Quyết định",
    "action_item": "Công việc",
    "document": "Tài liệu",
}

TRANSCRIPT_MIN_CHARS = 500
TRANSCRIPT_MAX_CHARS = 900
ITEM_MAX_CHARS = 900
DOCUMENT_MAX_CHARS = 900
DOCUMENT_OVERLAP_CHARS = 100

UNKNOWN_SPEAKER = "Không rõ"

# "[mm:ss] Người nói: lời nói" — dòng transcript trong content.
LINE_RE = re.compile(r"^(?:\[(\d+):(\d{2})\] )?([^:\n]{1,80}): (.*)$")


@dataclass
class Chunk:
    content: str
    start_ms: int | None = None
    end_ms: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def _clean(value: Any) -> str:
    """Gộp khoảng trắng về một dấu cách; None thành chuỗi rỗng."""
    return " ".join(str(value or "").split())


def _ms(value: Any) -> int | None:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return None


def fmt_ts(ms: int) -> str:
    """mm:ss; họp quá 60 phút thì phút cứ tăng (75:30) để vẫn đọc và sắp được."""
    seconds = max(0, int(ms)) // 1000
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def chunk_header(meeting_title: str, source_type: str, title: str | None = None) -> str:
    label = SOURCE_LABELS.get(source_type, source_type)
    source = f"{label} — {title}" if title and title != label else label
    return f"Cuộc họp: {meeting_title}\nNguồn: {source}"


def embed_text(header: str, content: str) -> str:
    return f"{header}\n\n{content}"


# ---------- Transcript ----------


def transcript_line(item: dict[str, Any]) -> str:
    speaker = _clean(item.get("speaker")) or UNKNOWN_SPEAKER
    start = _ms(item.get("startMs"))
    prefix = f"[{fmt_ts(start)}] " if start is not None else ""
    return f"{prefix}{speaker}: {_clean(item.get('text'))}"


def parse_line(line: str) -> tuple[int | None, str | None, str]:
    """Tách lại (giây bắt đầu tính bằng ms, người nói, lời nói) từ một dòng transcript."""
    match = LINE_RE.match(line.strip())
    if not match:
        return None, None, line.strip()
    minutes, seconds, speaker, text = match.groups()
    start = (int(minutes) * 60 + int(seconds)) * 1000 if minutes is not None else None
    return start, speaker.strip(), text.strip()


def chunk_transcript(
    items: list[dict[str, Any]],
    min_chars: int = TRANSCRIPT_MIN_CHARS,
    max_chars: int = TRANSCRIPT_MAX_CHARS,
) -> list[Chunk]:
    """Gom các lượt nói liền nhau thành đoạn ~min–max ký tự, không cắt lượt nói.

    Đoạn còn ngắn hơn min thì nhận thêm lượt kế tiếp dù vượt max một chút, để
    không sinh đoạn vụn; một lượt nói tự nó dài hơn max thì đứng riêng.
    """
    chunks: list[Chunk] = []
    group: list[tuple[str, dict[str, Any]]] = []
    size = 0

    def flush() -> None:
        if not group:
            return
        starts = [_ms(it.get("startMs")) for _, it in group]
        ends = [e for e in (_ms(it.get("endMs")) for _, it in group) if e is not None]
        # Người nói chính: nói nhiều chữ nhất trong đoạn, để hiện cạnh trích dẫn.
        weight: dict[str, int] = {}
        for line, it in group:
            name = _clean(it.get("speaker")) or UNKNOWN_SPEAKER
            weight[name] = weight.get(name, 0) + len(line)
        speakers = sorted(weight, key=lambda n: -weight[n])[:5]
        known = [s for s in starts if s is not None]
        chunks.append(
            Chunk(
                content="\n".join(line for line, _ in group),
                start_ms=known[0] if known else None,
                end_ms=max(ends) if ends else None,
                metadata={
                    "speaker": speakers[0],
                    "speakers": speakers,
                    "segmentCount": len(group),
                    # Mốc chính xác từng dòng; dòng chỉ ghi tới giây.
                    "lineStartMs": starts,
                },
            )
        )

    for item in items:
        if not _clean(item.get("text")):
            continue
        line = transcript_line(item)
        overflow = size + 1 + len(line) > max_chars
        if group and overflow and (size >= min_chars or len(line) > max_chars):
            flush()
            group, size = [], 0
        group.append((line, item))
        size += len(line) + (1 if size else 0)
    flush()
    return chunks


# ---------- Văn bản tự do: biên bản, quyết định, công việc, tài liệu ----------

# Cắt một đoạn văn quá dài: theo dòng, rồi theo câu, rồi theo từ.
_LEVELS = (
    ("\n", re.compile(r"\s*\n\s*")),
    (" ", re.compile(r"(?<=[.!?…;:])\s+")),
    (" ", re.compile(r"\s+")),
)


def _paragraphs(text: str) -> list[str]:
    out = []
    for block in re.split(r"\n\s*\n", str(text or "")):
        lines = [" ".join(line.split()) for line in block.splitlines()]
        block = "\n".join(line for line in lines if line)
        if block:
            out.append(block)
    return out


def _pieces(text: str, limit: int, level: int = 0) -> list[tuple[str, str]]:
    """Các mảnh ≤ limit kèm chuỗi nối với mảnh trước (để ghép lại đúng dạng)."""
    if len(text) <= limit:
        return [(text, "")]
    if level >= len(_LEVELS):
        # Một "từ" dài hơn giới hạn (URL, chuỗi mã): đành cắt cứng.
        return [(text[i : i + limit], "") for i in range(0, len(text), limit)]
    joiner, pattern = _LEVELS[level]
    parts = [p.strip() for p in pattern.split(text) if p.strip()]
    if len(parts) <= 1:
        return _pieces(text, limit, level + 1)
    out: list[tuple[str, str]] = []
    for part in parts:
        sub = _pieces(part, limit, level + 1)
        out.append((sub[0][0], joiner))
        out.extend(sub[1:])
    out[0] = (out[0][0], "")
    return out


def _tail(text: str, size: int) -> str:
    """Khoảng size ký tự cuối, bắt đầu ở ranh giới từ."""
    if len(text) <= size:
        return text
    tail = text[-size:]
    cut = tail.find(" ")
    return tail[cut + 1 :].lstrip() if 0 <= cut < len(tail) - 1 else tail


def split_text(text: str, max_chars: int, overlap: int = 0) -> list[str]:
    """Ghép đoạn văn thành khối ≤ ~max_chars, ưu tiên ranh giới đoạn văn.

    overlap > 0: khối sau lặp lại ~overlap ký tự cuối của khối trước, để ý
    nằm vắt qua ranh giới vẫn tìm được ở một trong hai khối.
    """
    # Chừa chỗ cho phần lặp và chuỗi nối (tối đa "\n\n") để khối không vượt max_chars.
    limit = max(50, max_chars - overlap - 2)
    units: list[tuple[str, str]] = []
    for paragraph in _paragraphs(text):
        pieces = _pieces(paragraph, limit)
        units.append((pieces[0][0], "\n\n"))
        units.extend(pieces[1:])

    chunks: list[str] = []
    current = ""
    for piece, joiner in units:
        if current and len(current) + len(joiner) + len(piece) > max_chars:
            chunks.append(current)
            tail = _tail(current, overlap) if overlap else ""
            current = f"{tail}{joiner or ' '}{piece}" if tail else piece
        else:
            current = f"{current}{joiner}{piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks


def chunk_items(items: list[dict[str, Any]], max_chars: int = ITEM_MAX_CHARS) -> list[Chunk]:
    """Biên bản / quyết định / công việc: mỗi mục một đoạn, mục dài cắt theo đoạn văn.

    Tiêu đề lặp lại ở mọi mảnh để mảnh nào cũng tự hiểu được khi đứng một mình.
    """
    chunks: list[Chunk] = []
    for position, item in enumerate(items):
        title = _clean(item.get("title"))
        body = str(item.get("text") or "").strip()
        if not title and not body:
            continue
        budget = max(200, max_chars - len(title) - 1)
        parts = split_text(body, budget) if body else [""]
        for part_index, part in enumerate(parts):
            metadata: dict[str, Any] = {"itemIndex": position}
            if title:
                metadata["title"] = title
            if _clean(item.get("speaker")):
                metadata["speaker"] = _clean(item.get("speaker"))
            if len(parts) > 1:
                metadata["part"] = part_index
            chunks.append(
                Chunk(
                    content="\n".join(x for x in (title, part) if x),
                    start_ms=_ms(item.get("startMs")),
                    end_ms=_ms(item.get("endMs")),
                    metadata=metadata,
                )
            )
    return chunks


def chunk_document(
    text: str,
    max_chars: int = DOCUMENT_MAX_CHARS,
    overlap: int = DOCUMENT_OVERLAP_CHARS,
) -> list[Chunk]:
    return [Chunk(content=part, metadata={"part": i}) for i, part in enumerate(split_text(text, max_chars, overlap))]
