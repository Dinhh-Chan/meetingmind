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


def is_loop(keys: list[str], times: int = 3, max_len: int = 6) -> bool:
    """Chuỗi từ có một cụm (1–6 từ) lặp liền nhau từ ba lần: dấu hiệu Whisper kẹt vòng lặp."""
    keys = [k for k in keys if k]
    for n in range(1, max_len + 1):
        for i in range(len(keys) - times * n + 1):
            if all(keys[i : i + n] == keys[i + j * n : i + (j + 1) * n] for j in range(1, times)):
                return True
    return False


def _spread(texts: list[str], start: float, end: float) -> list[WordT]:
    """Các từ chia đều khoảng [start, end] (khoảng rỗng hoặc ngược thì dồn về `start`)."""
    span = max(0.0, end - start)
    step = span / len(texts)
    return [(start + step * n, start + step * (n + 1), " " + t) for n, t in enumerate(texts)]


def _mean(values: list[float] | None, start: int, end: int) -> float | None:
    part = [v for v in (values or [])[start:end] if v is not None]
    return sum(part) / len(part) if part else None


def merge_words(
    base: list[WordT],
    refined: list[WordT],
    base_probs: list[float] | None = None,
    refined_probs: list[float] | None = None,
    margin: float | None = None,
    trust_longer: bool = False,
) -> list[WordT]:
    """Ghép lời Whisper (`base`) với lời mô hình tiếng Việt (`refined`) của cùng một câu.

    Căn hai chuỗi từ với nhau; chỗ giống thì giữ từ của Whisper (đủ chữ hoa, dấu
    câu); chỗ khác thì lấy từ của mô hình tiếng Việt, trừ khi Whisper có số hay
    từ tiếng Anh ở đó. Dấu câu cuối cụm và chữ hoa đầu câu / tên riêng được
    chuyển sang từ thay thế. Từ Whisper có mà mô hình kia không nghe ra thì giữ.

    Có độ tự tin từng từ (`*_probs`) và `margin` thì chỉ thay khi mô hình tiếng
    Việt tự tin hơn Whisper ít nhất `margin` ở đúng cụm đó: âm thanh quá kém thì
    cả hai cùng đoán, không có lý do đổi.

    `trust_longer`: mô hình tiếng Việt nghe ra nhiều gấp mấy lần Whisper trong cùng
    đoạn thì lấy lời của nó (Whisper chép cụt ở âm thanh kém). Chỉ bật cho mô hình
    không bịa chữ ở chỗ không có tiếng nói (transducer); PhoWhisper thì hay bịa.

    Mốc thời gian luôn theo Whisper: từ thay thế chia đều khoảng thời gian của cụm
    Whisper mà nó thay, từ thêm vào nằm ở khe giữa hai từ kề. Mốc của mô hình tiếng
    Việt không dùng — transducer phát token trễ so với âm thanh, lấy mốc đó làm
    lệch các khúc tách người nói (buổi học 2 người ra 3 người, đổi người 2 → 10 lần).
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
        # Trừ khi chính Whisper kẹt vòng lặp ("em cứ nổi loại, em cứ nổi loại, em cứ
        # nổi loại" ở âm thanh kém) còn mô hình tiếng Việt thì không: lấy lời của mô
        # hình tiếng Việt, giữ chữ hoa đầu câu và dấu câu cuối của Whisper.
        looped = len(refined) < 0.4 * words and is_loop(base_keys) and not is_loop(refined_keys)
        if looped or (trust_longer and len(refined) > 2 * words + 3):
            first = next((c for c in (_core(t) for _, _, t in base) if c), "")
            texts = [t.lower() for _, _, t in refined]
            if first[:1].isupper():
                texts[0] = texts[0][:1].upper() + texts[0][1:]
            texts[-1] += _trailing(base[-1][2])
            return _spread(texts, base[0][0], base[-1][1])
        return base

    out: list[WordT] = []
    for op, i1, i2, j1, j2 in SequenceMatcher(None, base_keys, refined_keys, autojunk=False).get_opcodes():
        if op == "equal" or op == "delete":
            out.extend(base[i1:i2])
        elif op == "insert":
            # Vài từ Whisper bỏ sót giữa câu; chuỗi dài bất thường thì bỏ (dễ là bịa).
            # Ở hai đầu câu thì bỏ: thường là tiếng của câu bên cạnh lọt vào phần nới
            # ("hôm Tối nay…"); đo trên VIVOS bỏ đi không làm sai thêm (5,31 % so với 5,28 %).
            if 0 < i1 < len(base) and j2 - j1 <= 6:
                out.extend(_spread([t.lower() for _, _, t in refined[j1:j2]], base[i1 - 1][1], base[i1][0]))
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
            picked = [t.lower() for _, _, t in refined[j1:j2]]
            for n, t in enumerate(picked):
                if title or (capital and n == 0):
                    picked[n] = t[0].upper() + t[1:]
            picked[-1] += tail
            out.extend(_spread(picked, block[0][0], block[-1][1]))
    return out


def in_order(words: list[WordT], lo: float, hi: float) -> list[WordT]:
    """Mốc từng từ nằm trong [lo, hi] và không lùi.

    Từ lấy của mô hình tiếng Việt mang mốc của mô hình đó, có thể lệch ra ngoài câu
    hoặc đè lên từ Whisper đứng cạnh; mốc lộn xộn làm khúc tách người nói rỗng.
    """
    out: list[WordT] = []
    prev = lo
    for a, b, t in words:
        a = min(max(a, prev), hi)
        b = min(max(b, a), hi)
        out.append((a, b, t))
        prev = b
    return out


# ---------- Model ----------

_model = None
_lock = threading.Lock()

# Tệp của mô hình transducer (Zipformer RNN-T, chạy bằng sherpa-onnx trên CPU).
_TRANSDUCER_FILES = ("encoder", "decoder", "joiner")


def model_path() -> str:
    return os.environ.get("AI_WHISPER_REFINE_MODEL", "").strip()


def enabled() -> bool:
    return bool(model_path())


def _onnx(path: str, name: str) -> str | None:
    """`<name>.onnx`, hoặc bản lượng tử hoá `<name>.int8.onnx` khi AI_WHISPER_REFINE_INT8=1."""
    names = [f"{name}.int8.onnx", f"{name}.onnx"] if os.environ.get("AI_WHISPER_REFINE_INT8") == "1" else [f"{name}.onnx"]
    return next((os.path.join(path, n) for n in names if os.path.exists(os.path.join(path, n))), None)


def is_transducer(path: str) -> bool:
    return all(_onnx(path, n) for n in _TRANSDUCER_FILES) and os.path.exists(os.path.join(path, "tokens.txt"))


def group_tokens(
    tokens: list[str], times: list[float], offset: float, log_probs: list[float] | None = None
) -> tuple[list[WordT], list[float] | None]:
    """Ghép token BPE thành từ kèm mốc: token mở đầu bằng ▁ hoặc dấu cách mở từ mới.

    sherpa-onnx trả token đã đổi ▁ thành dấu cách và viết hoa (" TIẾNG", " C", "Ạ", "CH").

    Có log-xác suất từng token thì độ tự tin của từ là exp(trung bình log-xác suất).
    """
    import math

    words: list[list] = []
    for i, (tok, ts) in enumerate(zip(tokens, times)):
        end = offset + (times[i + 1] if i + 1 < len(times) else ts + 0.2)
        lp = log_probs[i] if log_probs and i < len(log_probs) else None
        if tok[:1] in ("▁", " ") or not words:
            words.append([offset + ts, end, " " + tok.lstrip("▁ "), [lp]])
        else:
            words[-1][2] += tok
            words[-1][1] = end
            words[-1][3].append(lp)
    kept = [w for w in words if w[2].strip()]
    probs = None
    if log_probs and all(x is not None for w in kept for x in w[3]):
        probs = [math.exp(sum(w[3]) / len(w[3])) for w in kept]
    return [(a, b, t) for a, b, t, _ in kept], probs


class _WhisperEngine:
    """Whisper tinh chỉnh tiếng Việt (PhoWhisper) bằng CTranslate2: có độ tự tin từng từ."""

    # Đo trên VIVOS: chỉ thay khi PhoWhisper tự tin hơn (biên độ 0) sai 5,28 %, luôn thay 5,44 %.
    default_margin: float | None = 0.0
    # PhoWhisper hay bịa ở chỗ không có tiếng nói: nghe ra dài hơn hẳn Whisper thì không tin.
    trust_longer = False

    def __init__(self, path: str, device: str, compute_type: str):
        from faster_whisper import WhisperModel

        self.model = WhisperModel(path, device=device, compute_type=compute_type)

    def words(self, clip, offset: float) -> tuple[list[WordT], list[float] | None]:
        segments, _ = self.model.transcribe(
            clip,
            language="vi",
            beam_size=int(os.environ.get("AI_WHISPER_REFINE_BEAM_SIZE", "5")),
            word_timestamps=True,
            condition_on_previous_text=False,
            vad_filter=False,
        )
        found = [w for seg in segments for w in (seg.words or [])]
        return [(offset + float(w.start), offset + float(w.end), w.word) for w in found], [float(w.probability) for w in found]


class _TransducerEngine:
    """Zipformer RNN-T tiếng Việt (ví dụ gipformer) qua sherpa-onnx, chạy CPU.

    Độ tự tin từng từ lấy từ log-xác suất token (ys_log_probs của sherpa-onnx), nhưng
    thang đo khác Whisper nên mặc định không so: đo trên VIVOS với gipformer, luôn
    thay sai 4,71 % số từ, chỉ thay khi tự tin hơn (biên độ 0) sai 5,84 %.
    """

    default_margin: float | None = None
    # Transducer không bịa chữ ở chỗ lặng; trên bản ghi bot Meet bị đục nó nghe đúng cả
    # những đoạn Whisper chép cụt, nên nghe ra dài hơn hẳn thì lấy lời của nó.
    trust_longer = True

    def __init__(self, path: str):
        import sherpa_onnx

        self.recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=_onnx(path, "encoder"),
            decoder=_onnx(path, "decoder"),
            joiner=_onnx(path, "joiner"),
            tokens=os.path.join(path, "tokens.txt"),
            num_threads=int(os.environ.get("AI_WHISPER_REFINE_THREADS", "8")),
            sample_rate=16000,
            feature_dim=80,
            decoding_method="modified_beam_search",
            max_active_paths=int(os.environ.get("AI_WHISPER_REFINE_BEAM_SIZE", "4")),
        )

    def words(self, clip, offset: float) -> tuple[list[WordT], list[float] | None]:
        stream = self.recognizer.create_stream()
        stream.accept_waveform(16000, clip)
        self.recognizer.decode_stream(stream)
        result = stream.result
        log_probs = [float(x) for x in getattr(result, "ys_log_probs", None) or []] or None
        return group_tokens(list(result.tokens), [float(t) for t in result.timestamps], offset, log_probs)


def _load(device: str, compute_type: str):
    global _model
    with _lock:
        if _model is None:
            path = model_path()
            if is_transducer(path):
                log.info("Nạp mô hình sửa từ tiếng Việt (transducer, CPU) %s", path)
                _model = _TransducerEngine(path)
            else:
                log.info("Nạp mô hình sửa từ tiếng Việt %s device=%s compute=%s", path, device, compute_type)
                _model = _WhisperEngine(path, device, compute_type)
        return _model


def margin(default: float | None = 0.0) -> float | None:
    """Mô hình tiếng Việt phải tự tin hơn Whisper bấy nhiêu mới thay từ; `none` là luôn thay.

    Đo với PhoWhisper trên VIVOS test (300 câu, sạch / có ồn): luôn thay sai 5,44 % /
    6,74 % số từ; biên độ -0,1: 5,34 / 6,71; 0: 5,28 / 6,24; 0,1: 6,58 / 7,18.
    Không đặt AI_WHISPER_REFINE_MARGIN thì theo mặc định của từng loại mô hình
    (PhoWhisper: 0; transducer: luôn thay). Mô hình không trả độ tự tin thì luôn thay.
    """
    raw = os.environ.get("AI_WHISPER_REFINE_MARGIN")
    if raw is None or not raw.strip():
        return default
    raw = raw.strip().lower()
    return None if raw in ("none", "off") else float(raw)


def refine_words(
    clip, offset: float, base: list[WordT], device: str, compute_type: str, base_probs: list[float] | None = None
) -> list[WordT]:
    """Nghe lại một câu tiếng Việt và ghép với lời Whisper. Lỗi thì giữ nguyên lời Whisper."""
    if not enabled() or not base or len(clip) < 3200:
        return base
    try:
        engine = _load(device, compute_type)
        with _lock:
            refined, probs = engine.words(clip, offset)
        merged = merge_words(
            base,
            refined,
            base_probs,
            probs,
            margin(engine.default_margin) if probs is not None else None,
            trust_longer=engine.trust_longer,
        )
        return in_order(merged, min(a for a, _, _ in base), max(b for _, b, _ in base))
    except Exception as err:  # noqa: BLE001 - lượt sửa là phần thêm, không được làm hỏng phiên âm
        if isinstance(err, RuntimeError) and "cuda" in str(err).lower():
            from app.worker import gpu_watch

            gpu_watch.mark_lost(err)
            log.warning("Lượt sửa từ tiếng Việt cần GPU (%s), giữ lời Whisper", err)
        else:
            log.exception("Lượt sửa từ tiếng Việt lỗi, giữ lời Whisper")
        return base
