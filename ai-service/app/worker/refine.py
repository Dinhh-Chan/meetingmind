"""Lượt hai bằng mô hình chuyên tiếng Việt để sửa từ sai của Whisper.

Whisper đa ngữ (large-v3-turbo) cho câu, dấu câu, mốc thời gian, số và từ tiếng
Anh tốt, nhưng sai từ tiếng Việt nhiều: đo trên VIVOS test (300 câu) sai 9,4 %
số từ, có ồn 11,9 %. PhoWhisper-large (VinAI, tinh chỉnh riêng cho tiếng Việt)
chỉ sai 4,9 % / 6,1 %, nhưng viết thường toàn bộ, không dấu câu, không ngắt câu,
phiên âm từ tiếng Anh và số thành chữ, và hay bịa ở đoạn không có tiếng nói.

Nên dùng cả hai: Whisper chép trước; mỗi câu tiếng Việt được mô hình tiếng Việt
nghe lại, rồi ghép theo từng từ — từ tiếng Việt lấy của mô hình tiếng Việt, còn
dấu câu, chữ hoa, số và từ tiếng Anh giữ của Whisper. Chỉ nghe lại ở chỗ Whisper
đã thấy tiếng nói nên không rước thêm câu bịa, và chỉ thay cụm từ mà mô hình tiếng
Việt tự tin hơn Whisper (âm thanh quá kém thì cả hai cùng đoán, không có lý do đổi).
Ghép lại sai 5,3 % / 6,2 % trên cùng bộ đo.

Bật bằng AI_WHISPER_REFINE_MODEL (đường dẫn model CTranslate2). Để trống thì tắt.
"""

from __future__ import annotations

import logging
import os
import re
import threading
import unicodedata
from difflib import SequenceMatcher

log = logging.getLogger("ai-worker")

# (bắt đầu, kết thúc, chữ) — chữ có dấu cách đứng trước như từ của Whisper.
WordT = tuple[float, float, str]

_EDGE = re.compile(r"^\W+|\W+$", re.UNICODE)
# Âm tiết tiếng Việt viết không dấu: phụ âm đầu (nếu có) + cụm nguyên âm + phụ âm cuối (nếu có).
_VI_PLAIN = re.compile(
    r"^(ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnprstvx])?[aeiouy]{1,3}(ng|nh|ch|[cmnpt])?$"
)


def _core(token: str) -> str:
    """Từ đã bỏ dấu câu hai đầu."""
    return _EDGE.sub("", token.strip())


def _key(token: str) -> str:
    return unicodedata.normalize("NFC", _core(token)).lower()


def _is_ascii_word(core: str) -> bool:
    return bool(core) and core.isascii() and core.isalpha()


def is_protected(token: str, first: bool) -> bool:
    """Từ phải giữ nguyên của Whisper: số, từ tiếng Anh, tên riêng viết không dấu.

    Mô hình tiếng Việt viết số thành chữ ("mười một") và phiên âm tiếng Anh
    ("đét lai"), nên những từ này không được thay.
    """
    core = _core(token)
    if not core:
        return False
    if any(ch.isdigit() for ch in core):
        return True
    if not _is_ascii_word(core):
        return False
    if not _VI_PLAIN.match(core.lower()):
        return True
    # Viết hoa giữa câu mà không có dấu: tên riêng / tên sản phẩm (Meet, Team).
    return core[0].isupper() and not first


def _trailing(token: str) -> str:
    stripped = token.rstrip()
    core = _core(stripped)
    return stripped[stripped.rfind(core) + len(core) :] if core else ""


def _mean(values: list[float] | None, start: int, end: int) -> float | None:
    part = [v for v in (values or [])[start:end] if v is not None]
    return sum(part) / len(part) if part else None


def merge_words(
    base: list[WordT],
    refined: list[WordT],
    base_probs: list[float] | None = None,
    refined_probs: list[float] | None = None,
    margin: float | None = None,
) -> list[WordT]:
    """Ghép lời Whisper (`base`) với lời mô hình tiếng Việt (`refined`) của cùng một câu.

    Căn hai chuỗi từ với nhau; chỗ giống thì giữ từ của Whisper (đủ chữ hoa, dấu
    câu); chỗ khác thì lấy từ của mô hình tiếng Việt, trừ khi Whisper có số hay
    từ tiếng Anh ở đó. Dấu câu cuối cụm và chữ hoa đầu câu / tên riêng được
    chuyển sang từ thay thế. Từ Whisper có mà mô hình kia không nghe ra thì giữ.

    Có độ tự tin từng từ (`*_probs`) và `margin` thì chỉ thay khi mô hình tiếng
    Việt tự tin hơn Whisper ít nhất `margin` ở đúng cụm đó: âm thanh quá kém thì
    cả hai cùng đoán, không có lý do đổi.
    """
    kept = [i for i, (_, _, t) in enumerate(refined) if _key(t)]
    refined_probs = [refined_probs[i] for i in kept] if refined_probs else None
    refined = [(refined[i][0], refined[i][1], _core(refined[i][2])) for i in kept]
    if not base or not refined:
        return base
    base_keys = [_key(t) for _, _, t in base]
    refined_keys = [_key(t) for _, _, t in refined]
    words = sum(1 for k in base_keys if k)
    # Lệch hẳn về độ dài: một trong hai bên nghe hỏng, đừng trộn.
    if len(refined) > 2 * words + 3 or len(refined) < 0.4 * words:
        return base

    out: list[WordT] = []
    for op, i1, i2, j1, j2 in SequenceMatcher(None, base_keys, refined_keys, autojunk=False).get_opcodes():
        if op == "equal" or op == "delete":
            out.extend(base[i1:i2])
        elif op == "insert":
            # Vài từ Whisper bỏ sót; chuỗi dài bất thường thì bỏ (dễ là bịa).
            if j2 - j1 <= 6:
                out.extend((a, b, " " + t.lower()) for a, b, t in refined[j1:j2])
        else:
            block = base[i1:i2]
            if any(is_protected(t, first=i == 0) for i, (_, _, t) in enumerate(block, start=i1)):
                out.extend(block)
                continue
            ours, theirs = _mean(base_probs, i1, i2), _mean(refined_probs, j1, j2)
            if margin is not None and ours is not None and theirs is not None and theirs < ours + margin:
                out.extend(block)
                continue
            cores = [_core(t) for _, _, t in block if _core(t)]
            # Cả cụm viết hoa: tên riêng. Chỉ từ đầu viết hoa ở đầu câu: chữ hoa đầu câu.
            title = len(cores) > 1 and all(c[0].isupper() for c in cores) and i1 > 0
            capital = bool(cores) and cores[0][0].isupper() and (i1 == 0 or title)
            tail = _trailing(block[-1][2])
            picked = [(a, b, t.lower()) for a, b, t in refined[j1:j2]]
            for n, (a, b, t) in enumerate(picked):
                if title or (capital and n == 0):
                    t = t[0].upper() + t[1:]
                if n == len(picked) - 1:
                    t += tail
                out.append((a, b, " " + t))
    return out


# ---------- Model ----------

_model = None
_lock = threading.Lock()


def model_path() -> str:
    return os.environ.get("AI_WHISPER_REFINE_MODEL", "").strip()


def enabled() -> bool:
    return bool(model_path())


def _load(device: str, compute_type: str):
    global _model
    with _lock:
        if _model is None:
            from faster_whisper import WhisperModel

            log.info("Nạp mô hình sửa từ tiếng Việt %s device=%s compute=%s", model_path(), device, compute_type)
            _model = WhisperModel(model_path(), device=device, compute_type=compute_type)
        return _model


def margin() -> float | None:
    """Mô hình tiếng Việt phải tự tin hơn Whisper bấy nhiêu mới thay từ; `none` là luôn thay.

    Đo trên VIVOS test (300 câu, sạch / có ồn): luôn thay sai 5,44 % / 6,74 % số từ;
    biên độ -0,1: 5,34 / 6,71; 0: 5,28 / 6,24; 0,1: 6,58 / 7,18. Mặc định 0.
    """
    raw = os.environ.get("AI_WHISPER_REFINE_MARGIN", "0").strip().lower()
    return None if raw in ("", "none", "off") else float(raw)


def refine_words(
    clip, offset: float, base: list[WordT], device: str, compute_type: str, base_probs: list[float] | None = None
) -> list[WordT]:
    """Nghe lại một câu tiếng Việt và ghép với lời Whisper. Lỗi thì giữ nguyên lời Whisper."""
    if not enabled() or not base or len(clip) < 3200:
        return base
    try:
        model = _load(device, compute_type)
        with _lock:
            segments, _ = model.transcribe(
                clip,
                language="vi",
                beam_size=int(os.environ.get("AI_WHISPER_REFINE_BEAM_SIZE", "5")),
                word_timestamps=True,
                condition_on_previous_text=False,
                vad_filter=False,
            )
            found = [w for seg in segments for w in (seg.words or [])]
        refined = [(offset + float(w.start), offset + float(w.end), w.word) for w in found]
        return merge_words(base, refined, base_probs, [float(w.probability) for w in found], margin())
    except Exception:  # noqa: BLE001 - lượt sửa là phần thêm, không được làm hỏng phiên âm
        log.exception("Lượt sửa từ tiếng Việt lỗi, giữ lời Whisper")
        return base

