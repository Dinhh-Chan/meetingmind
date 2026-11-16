"""Chuẩn hoá transcript bằng LLM sau khi nhận dạng.

Máy nghe còn sai ở từ gần âm và thuật ngữ tiếng Anh ("đẩy vốt lên nhánh dev", "tài
liệu trên sơ walker", "câu truy cập SQL"). Người đọc nhìn ngữ cảnh là biết phải là
"code", "Swagger", "truy vấn"; LLM cũng vậy. Ở đây LLM đọc transcript theo từng khối
dòng và chỉ trả những dòng nó sửa.

LLM viết trôi chảy nên dễ "sửa" quá tay: đoán bừa ở chỗ lời máy vô nghĩa, diễn đạt
lại, thêm ý, đổi con số. Hai lớp chặn:
- Bỏ phiếu: mỗi khối được sửa vài lần độc lập (`votes`), chỉ nhận chỗ sửa mà ít nhất
  `min_agree` lần cùng đưa ra. Chỗ model biết chắc ("sơ walker" → "Swagger") lần nào
  cũng ra như nhau; chỗ nó đoán thì mỗi lần một kiểu.
- Kiểm tra từng dòng (`acceptable`): không đổi quá nửa số từ, không dài/ngắn hẳn đi,
  không đổi con số; trượt thì giữ nguyên lời máy.
Lời máy gốc luôn được giữ ở `rawText` để đối chiếu. Lỗi LLM (hết giờ, JSON hỏng) không
làm hỏng phiên âm: khối đó giữ nguyên.

Đo trên bản ghi bot Meet có lời chuẩn (xem README): gemma-4-31B-it trả trong 1–2 giây
mỗi khối và sửa được nhiều nhất; DeepSeek-V4.1-Flash sửa chắc tay hơn nhưng mất 26–160
giây mỗi khối; GLM-5.2 và gpt-oss-120b sửa sai cả chỗ đang đúng.

Tắt bằng AI_POLISH=0. Không có AI_LLM_API_KEY thì tự bỏ qua.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

import httpx

from app.worker.llm_analyzer import LlmError, parse_json, stream_completion

log = logging.getLogger("ai-worker")

SYSTEM_PROMPT = """Bạn sửa lỗi nhận dạng tiếng nói trong bản ghi cuộc họp tiếng Việt. Mỗi dòng là một đoạn lời do máy nghe rồi chép lại, có thể sai từ.

ĐƯỢC LÀM:
- Sửa từ máy nghe nhầm khi ngữ cảnh cho thấy rõ từ đúng (từ gần âm, sai dấu thanh). Ví dụ: "chất lại phương án" → "chốt lại phương án"; "hạn là cuối tôm nay" → "hạn là cuối tuần này".
- Viết đúng thuật ngữ, tên công nghệ, tên sản phẩm tiếng Anh bị chép theo âm tiếng Việt. Ví dụ: "phai bây sơ" → "Firebase"; "đốc cơ" → "Docker"; "gít háp" → "GitHub"; "đét lai" → "deadline".
- Viết đúng tên người tham dự và thuật ngữ của dự án nếu được cho bên dưới; viết hoa tên riêng.
- Thêm dấu câu và chữ hoa đầu câu khi thiếu.

KHÔNG ĐƯỢC LÀM:
- Không thêm ý, bớt ý, tóm tắt, diễn đạt lại, đổi giọng văn hay dịch. Giữ nguyên cách nói của người nói, kể cả từ đệm ("thì", "là", "ạ", "nhé").
- Không đổi con số, ngày giờ, đơn vị.
- Không gộp, tách hay đổi thứ tự dòng.
- Không chắc từ đúng là gì thì GIỮ NGUYÊN chữ của máy. Sửa ít còn hơn sửa sai.

Chỉ trả về MỘT object JSON, không giải thích:
{"lines": [{"i": <số dòng>, "text": "<dòng sau khi sửa>"}]}
Chỉ liệt kê những dòng có sửa. Không dòng nào cần sửa thì trả {"lines": []}."""


@dataclass(frozen=True)
class Settings:
    base_url: str = "https://token-api.fpt.ai/v1"
    api_key: str = ""
    # Model không suy luận, trả trong vài giây: bước này chạy trước khi transcript hiện ra.
    model: str = "gemma-4-31B-it"
    fallback_model: str = ""
    max_tokens: int = 8000
    timeout_s: float = 120.0
    # Đủ cao để các lần sửa độc lập khác nhau ở chỗ model đoán (bỏ phiếu mới có tác dụng).
    temperature: float = 0.6
    # Số lần sửa độc lập mỗi khối và số lần tối thiểu phải cùng đưa ra một chỗ sửa.
    votes: int = 3
    min_agree: int = 2
    # Số dòng mỗi lần gọi, và số dòng liền trước đưa kèm làm ngữ cảnh (không sửa).
    chunk_lines: int = 50
    context_lines: int = 6
    concurrency: int = 3
    # Tỷ lệ từ được phép đổi trong một dòng.
    max_change: float = 0.5

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ.get
        return cls(
            base_url=env("AI_LLM_BASE_URL", cls.base_url).rstrip("/"),
            api_key=env("AI_LLM_API_KEY", cls.api_key),
            model=env("AI_POLISH_MODEL", cls.model),
            fallback_model=env("AI_POLISH_FALLBACK_MODEL", cls.fallback_model),
            max_tokens=int(env("AI_POLISH_MAX_TOKENS", str(cls.max_tokens))),
            timeout_s=float(env("AI_POLISH_TIMEOUT_S", str(cls.timeout_s))),
            temperature=float(env("AI_POLISH_TEMPERATURE", str(cls.temperature))),
            chunk_lines=int(env("AI_POLISH_CHUNK_LINES", str(cls.chunk_lines))),
            votes=max(1, int(env("AI_POLISH_VOTES", str(cls.votes)))),
            min_agree=max(1, int(env("AI_POLISH_MIN_AGREE", str(cls.min_agree)))),
            max_change=float(env("AI_POLISH_MAX_CHANGE", str(cls.max_change))),
        )


def enabled(settings: Settings | None = None) -> bool:
    if os.environ.get("AI_POLISH", "1") in ("0", "false"):
        return False
    return bool((settings or Settings.from_env()).api_key)


# ---------- Hàm thuần: dựng prompt, kiểm tra từng dòng sửa ----------


def _tokens(text: str) -> list[str]:
    text = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"[^\w\s]", " ", text).split()


def _numbers(text: str) -> list[str]:
    return sorted(re.findall(r"\d+", text))


def _distance(a: list[str], b: list[str]) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, y in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y))
        prev = cur
    return prev[-1]


def acceptable(original: str, corrected: str, max_change: float = 0.5) -> bool:
    """Dòng sửa có còn là "sửa lỗi nghe" không, hay LLM đã viết lại / thêm bớt nội dung."""
    corrected = corrected.strip()
    if not corrected:
        return False
    before, after = _tokens(original), _tokens(corrected)
    if not before or not after:
        return False
    # Con số là dữ kiện (hạn, số tiền, tỷ lệ): không được đổi.
    if _numbers(original) != _numbers(corrected):
        return False
    # Thêm bớt hẳn nội dung.
    if len(after) > 1.5 * len(before) + 2 or len(after) < 0.6 * len(before) - 1:
        return False
    # Đổi quá nhiều từ: viết lại chứ không còn là sửa lỗi nghe. Dòng rất ngắn được nới
    # hai từ ("sơ walker" → "Swagger").
    return _distance(before, after) <= max(2, max_change * len(before))


def build_messages(
    lines: list[tuple[int, str, str]],
    context: list[tuple[int, str, str]] | None = None,
    people: list[str] | None = None,
    title: str | None = None,
    glossary: list[str] | None = None,
) -> list[dict[str, str]]:
    """`lines`: (số dòng, người nói, lời). `context`: vài dòng liền trước, chỉ để hiểu mạch."""
    parts: list[str] = []
    if title:
        parts.append(f"Cuộc họp: {title}")
    if people:
        parts.append("Người tham dự: " + ", ".join(people))
    if glossary:
        parts.append("Thuật ngữ của dự án: " + ", ".join(glossary))
    if context:
        parts.append("Các dòng liền trước (chỉ để hiểu ngữ cảnh, KHÔNG sửa, không trả lại):")
        parts.extend(f"[{i}] {speaker}: {text}" for i, speaker, text in context)
    parts.append("Các dòng cần xem và sửa:")
    parts.extend(f"[{i}] {speaker}: {text}" for i, speaker, text in lines)
    return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": "\n".join(parts)}]


def read_lines(data: dict[str, Any], lines: list[tuple[int, str, str]]) -> dict[int, str]:
    """Các dòng model trả về {số dòng: lời đã sửa}, đã bỏ dòng lạ và dòng không đổi."""
    originals = {i: text for i, _, text in lines}
    speakers = {i: speaker for i, speaker, _ in lines}
    found: dict[int, str] = {}
    for item in data.get("lines") or []:
        if not isinstance(item, dict):
            continue
        try:
            index = int(item.get("i"))
        except (TypeError, ValueError):
            continue
        text = str(item.get("text") or "").strip()
        if index not in originals or not text:
            continue
        # Model đôi khi chép lại cả tiền tố "Người nói 1:" của dòng.
        prefix = f"{speakers[index]}:"
        if text.startswith(prefix):
            text = text[len(prefix) :].strip()
        if text != originals[index].strip():
            found[index] = text
    return found


def _key(token: str) -> str:
    return re.sub(r"^\W+|\W+$", "", unicodedata.normalize("NFC", token).lower())


def edit_ops(original: str, corrected: str) -> list[tuple[int, int, tuple[str, ...]]]:
    """Các chỗ sửa của một dòng: (từ thứ i1, tới i2, các từ thay vào), theo từ của dòng gốc.

    Từ chỉ khác chữ hoa / dấu câu cũng là một chỗ sửa (cùng vị trí, một từ).
    """
    a, b = original.split(), corrected.split()
    ops: list[tuple[int, int, tuple[str, ...]]] = []
    matcher = SequenceMatcher(None, [_key(t) for t in a], [_key(t) for t in b], autojunk=False)
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            ops.extend((i1 + k, i1 + k + 1, (b[j1 + k],)) for k in range(i2 - i1) if a[i1 + k] != b[j1 + k])
        else:
            ops.append((i1, i2, tuple(b[j1:j2])))
    return ops


def vote(original: str, candidates: list[str], min_agree: int) -> str:
    """Dòng gốc với những chỗ sửa mà ít nhất `min_agree` bản sửa cùng đưa ra.

    Hai bản "cùng đưa ra" một chỗ sửa khi cùng vị trí và cùng từ, không kể chữ hoa và
    dấu câu ("code" và "code," là một); cách viết lấy theo số đông.
    """
    counts: Counter = Counter()
    forms: dict[tuple, Counter] = {}
    for candidate in candidates:
        seen = set()
        for i1, i2, new in edit_ops(original, candidate):
            key = (i1, i2, tuple(_key(t) for t in new))
            if key in seen:
                continue
            seen.add(key)
            counts[key] += 1
            forms.setdefault(key, Counter())[new] += 1
    agreed = sorted(
        ((key[0], key[1], forms[key].most_common(1)[0][0]) for key, n in counts.items() if n >= min_agree),
        key=lambda op: (op[0], op[1]),
    )
    tokens = original.split()
    out: list[str] = []
    cursor = 0
    for i1, i2, new in agreed:
        if i1 < cursor:
            continue  # chồng lên chỗ sửa đã nhận: bỏ
        out.extend(tokens[cursor:i1])
        out.extend(new)
        cursor = i2
    out.extend(tokens[cursor:])
    return " ".join(out)


def combine(
    lines: list[tuple[int, str, str]], runs: list[dict[int, str]], min_agree: int, max_change: float
) -> tuple[dict[int, str], int]:
    """Gộp các lần sửa độc lập: {số dòng: lời mới} đã qua bỏ phiếu và kiểm tra, cùng số dòng bị loại."""
    need = min(min_agree, len(runs))
    changes: dict[int, str] = {}
    rejected = 0
    for index, _, original in lines:
        candidates = [run[index] for run in runs if index in run]
        if len(candidates) < need:
            continue
        text = vote(original, candidates, need)
        if text == original.strip() or text == " ".join(original.split()):
            continue
        if acceptable(original, text, max_change):
            changes[index] = text
        else:
            rejected += 1
    return changes, rejected


# ---------- Gọi LLM ----------


async def _ask(
    client: httpx.AsyncClient,
    settings: Settings,
    messages: list[dict[str, str]],
    lines: list[tuple[int, str, str]],
) -> dict[int, str]:
    """Một lần sửa của model cho một khối."""
    errors: list[str] = []
    for model in [m for m in (settings.model, settings.fallback_model) if m]:
        body = {
            "model": model,
            "messages": messages,
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
            "stream": True,
        }
        try:
            content = await asyncio.wait_for(stream_completion(client, body), timeout=settings.timeout_s)
            return read_lines(parse_json(content), lines)
        except (httpx.HTTPError, LlmError, asyncio.TimeoutError) as err:
            errors.append(f"{model}: {str(err) or type(err).__name__}")
    raise LlmError("; ".join(errors))


async def _polish_chunk(
    client: httpx.AsyncClient,
    settings: Settings,
    lines: list[tuple[int, str, str]],
    context: list[tuple[int, str, str]],
    people: list[str] | None,
    title: str | None,
    glossary: list[str] | None,
) -> tuple[dict[int, str], int]:
    messages = build_messages(lines, context, people, title, glossary)
    answers = await asyncio.gather(
        *(_ask(client, settings, messages, lines) for _ in range(settings.votes)), return_exceptions=True
    )
    runs = [a for a in answers if isinstance(a, dict)]
    if len(runs) < min(settings.min_agree, settings.votes):
        failures = [str(a) or type(a).__name__ for a in answers if not isinstance(a, dict)]
        raise LlmError("; ".join(failures) or "không đủ lần sửa")
    return combine(lines, runs, settings.min_agree, settings.max_change)


async def polish(
    segments: list[dict[str, Any]],
    people: list[str] | None = None,
    title: str | None = None,
    glossary: list[str] | None = None,
    settings: Settings | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Transcript đã chuẩn hoá và thống kê {"changed", "rejected", "failed_chunks"}.

    Mọi đoạn trả về đều có `rawText` (lời máy gốc); `text` chỉ khác `rawText` ở dòng
    LLM sửa và qua được kiểm tra.
    """
    settings = settings or Settings.from_env()
    out = [{**s, "rawText": s.get("rawText") or s.get("text") or ""} for s in segments]
    stats = {"changed": 0, "rejected": 0, "failed_chunks": 0}
    numbered = [
        (i, str(s.get("speakerLabel") or "Người nói"), str(s.get("text") or "").strip())
        for i, s in enumerate(out, start=1)
        if str(s.get("text") or "").strip()
    ]
    if not numbered or not enabled(settings):
        return out, stats

    chunks = [numbered[k : k + settings.chunk_lines] for k in range(0, len(numbered), settings.chunk_lines)]
    gate = asyncio.Semaphore(settings.concurrency)

    async with httpx.AsyncClient(
        base_url=settings.base_url,
        headers={"Authorization": f"Bearer {settings.api_key}"},
        timeout=httpx.Timeout(90.0, connect=15.0),
        transport=transport,
    ) as client:

        async def run(n: int):
            context = chunks[n - 1][-settings.context_lines :] if n else []
            async with gate:
                try:
                    return await _polish_chunk(client, settings, chunks[n], context, people, title, glossary)
                except LlmError as err:
                    log.warning("Chuẩn hoá transcript: khối %d/%d lỗi, giữ nguyên lời máy: %s", n + 1, len(chunks), err)
                    return None

        results = await asyncio.gather(*(run(n) for n in range(len(chunks))))

    for result in results:
        if result is None:
            stats["failed_chunks"] += 1
            continue
        changes, rejected = result
        stats["rejected"] += rejected
        for index, text in changes.items():
            out[index - 1]["text"] = text
            stats["changed"] += 1
    return out, stats
