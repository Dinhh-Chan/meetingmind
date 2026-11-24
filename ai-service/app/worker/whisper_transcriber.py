"""Phiên âm thật bằng faster-whisper, nhận diện ngôn ngữ theo từng đoạn.

Whisper chỉ nhận diện ngôn ngữ một lần ở 30 giây đầu rồi giải mã cả bài bằng
ngôn ngữ đó. Cuộc họp nói lẫn Việt – Anh thì câu tiếng Anh bị ép giải mã như
tiếng Việt và ra chữ vô nghĩa (hoặc bị dịch). Nên làm hai lượt:

1. Chọn ngôn ngữ chính cho cả bài, phiên âm có lọc khoảng lặng (VAD, xem
   speech_regions.py).
2. Với từng đoạn đủ dài, nhận diện lại ngôn ngữ trên chính đoạn audio đó; nếu
   khác ngôn ngữ chính và đủ chắc thì phiên âm lại đoạn đó bằng ngôn ngữ của nó.

Whisper không tách người nói: lời được ghép với lượt nói của diarizer.py
("Người nói 1, 2…", đánh dấu chỗ nói chồng). Tắt bằng AI_DIARIZATION=0.
"""

import asyncio
import logging
import math
import os
import re
import threading
import uuid
from dataclasses import dataclass
from typing import Any

from app.worker import gpu_watch
from app.worker.equalize import equalize
from app.worker.diarizer import Diarizer, Word, build_segments
from app.worker import refine
from app.worker.speech_regions import speech_filter, speech_probe
from app.worker.storage import download_to_temp
from app.worker.transcriber import TranscriptResult

log = logging.getLogger("ai-worker")

SAMPLE_RATE = 16000
SPEAKER_LABEL = "Người nói 1"

# Câu Whisper hay bịa ra ở đoạn im lặng hoặc ồn: học từ phụ đề video trên mạng.
HALLUCINATIONS = re.compile(
    r"(đăng ký kênh|subscribe|ghiền mì gõ|la la school|like và share|bấm chuông|"
    r"gặp lại[^.!?]{0,40}video|thanks for watching|"
    r"cảm ơn các bạn đã (theo dõi|xem video))",
    re.IGNORECASE,
)


def is_hallucination(text: str) -> bool:
    return bool(HALLUCINATIONS.search(text))


@dataclass(frozen=True)
class Settings:
    model: str = "small"
    device: str = "auto"
    compute_type: str = "int8"
    beam_size: int = 5
    # Ngôn ngữ chính: dưới ngưỡng này thì tin ngôn ngữ cuộc họp do Core gửi. Lời nói thật
    # 30 giây thường được trên 0,9; âm thanh kém cho kết quả lưng chừng thì không đủ để
    # bỏ ngôn ngữ người dùng đã chọn cho cuộc họp.
    base_min_prob: float = 0.8
    # Đổi ngôn ngữ một đoạn chỉ khi chắc chắn: đoạn ngắn hay bị đoán nhầm. Đo trên bản
    # ghi thật: đoạn tiếng Việt 1,5–2,8 s bị nhận là tiếng Indonesia (0,99), Tây Ban Nha
    # (0,70), Anh (0,74); tiếng Anh thật (khúc 2 s) được 0,87–0,97.
    segment_min_prob: float = 0.9
    # Đoạn ngắn hơn ngần này không đủ âm thanh để nhận diện ngôn ngữ.
    min_detect_seconds: float = 3.0
    # Một đoạn chỉ được đổi sang các ngôn ngữ này (ngoài ngôn ngữ chính của bài).
    # Buổi học tiếng Việt qua Meet từng có 3,5 % thời lượng bị nhận là tiếng Tây Ban
    # Nha / Indonesia rồi bị chép lại bằng tiếng đó.
    languages: tuple[str, ...] = ("vi", "en")

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ.get
        return cls(
            model=env("AI_WHISPER_MODEL", cls.model),
            device=env("AI_WHISPER_DEVICE", cls.device),
            compute_type=env("AI_WHISPER_COMPUTE_TYPE", cls.compute_type),
            beam_size=int(env("AI_WHISPER_BEAM_SIZE", str(cls.beam_size))),
            base_min_prob=float(env("AI_WHISPER_BASE_MIN_PROB", str(cls.base_min_prob))),
            segment_min_prob=float(env("AI_WHISPER_SEGMENT_MIN_PROB", str(cls.segment_min_prob))),
            min_detect_seconds=float(env("AI_WHISPER_MIN_DETECT_SECONDS", str(cls.min_detect_seconds))),
            languages=tuple(
                x.strip().lower() for x in env("AI_WHISPER_LANGUAGES", ",".join(cls.languages)).split(",") if x.strip()
            ),
        )


# ---------- Quyết định ngôn ngữ: hàm thuần, test được không cần model ----------


def choose_base_language(
    detected: str | None, probability: float, hint: str | None, min_prob: float
) -> str | None:
    """Ngôn ngữ chính của cả bài.

    Tin kết quả nhận diện khi đủ chắc; không thì dùng ngôn ngữ cuộc họp do Core
    gửi (mặc định "vi"); không có gợi ý thì để Whisper tự quyết.
    """
    if detected and probability >= min_prob:
        return detected
    return hint or detected


def choose_segment_language(
    base: str,
    previous: str,
    duration_s: float,
    guess: tuple[str, float] | None,
    settings: Settings,
) -> str:
    """Ngôn ngữ của một đoạn.

    - Đoạn quá ngắn: giữ ngôn ngữ đoạn trước — người nói thường không đổi tiếng
      giữa chừng một câu ngắn.
    - Đủ dài và nhận diện chắc chắn: dùng kết quả nhận diện, nếu đó là ngôn ngữ
      chính hoặc ngôn ngữ được phép xen vào (mặc định Việt, Anh).
    - Nhận diện không chắc hoặc ra ngôn ngữ lạ: về ngôn ngữ chính.
    """
    if duration_s < settings.min_detect_seconds or guess is None:
        return previous
    language, probability = guess
    if probability >= settings.segment_min_prob and (language == base or language in settings.languages):
        return language
    return base


_VIETNAMESE_MARKS = set("ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ")
# Lời nói thật hiếm khi dưới ngần này từ mỗi giây trên cả một đoạn.
MIN_WORDS_PER_SECOND = 1.0


def plausible_switch(language: str, base: str, words: list[tuple[float, float, str]], duration_s: float) -> bool:
    """Bản chép lại bằng ngôn ngữ khác ngôn ngữ chính có đáng tin không.

    Hai dấu hiệu Whisper nhận nhầm ngôn ngữ ở âm thanh kém, thấy trên bản ghi bot Meet:
    - chép "bằng tiếng Anh" mà ra chữ có dấu tiếng Việt ("Và chốt task cho cái sprint
      này"): câu tiếng Việt xen thuật ngữ tiếng Anh;
    - cả đoạn dài chỉ ra vài chữ ("How about the game?" cho 18 giây): câu bịa.
    """
    text = "".join(t for _, _, t in words).lower()
    if language != "vi" and base == "vi" and any(ch in _VIETNAMESE_MARKS for ch in text):
        return False
    return len(text.split()) >= MIN_WORDS_PER_SECOND * duration_s


def language_breakdown(segments: list[dict[str, Any]]) -> dict[str, float]:
    """Tỷ lệ thời lượng nói theo từng ngôn ngữ, cộng lại bằng 1."""
    totals: dict[str, int] = {}
    for s in segments:
        duration = max(0, s["endMs"] - s["startMs"])
        totals[s["language"]] = totals.get(s["language"], 0) + duration
    whole = sum(totals.values())
    if not whole:
        return {}
    return {lang: round(ms / whole, 3) for lang, ms in sorted(totals.items(), key=lambda x: -x[1])}


def confidence_of(avg_logprob: float | None) -> float | None:
    """avg_logprob của Whisper → xác suất trung bình mỗi token, trong [0, 1]."""
    if avg_logprob is None:
        return None
    return round(min(1.0, max(0.0, math.exp(avg_logprob))), 3)


# ---------- Model ----------

_model = None
_model_lock = threading.Lock()
_diarizer = None


def _load_diarizer():
    global _diarizer
    with _model_lock:
        if _diarizer is None:
            _diarizer = Diarizer()
        return _diarizer


def is_cuda_error(err: BaseException) -> bool:
    """Lỗi do GPU (driver, không thấy thiết bị, hết bộ nhớ GPU), không phải do bản ghi."""
    return isinstance(err, RuntimeError) and "cuda" in str(err).lower()


def _load_model(settings: Settings, force_cpu: bool = False):
    """Nạp một lần mỗi tiến trình: model vài trăm MB, nạp lại mỗi job rất chậm.

    Lần đầu faster-whisper tải model từ Hugging Face về ~/.cache/huggingface
    (gắn volume trong docker-compose để không tải lại khi dựng lại container).

    Cấu hình GPU mà container không thấy GPU (driver lỗi, GPU bị lấy mất) thì
    chạy CPU: chậm hơn nhưng bản ghi vẫn ra transcript thay vì báo lỗi.
    """
    global _model
    with _model_lock:
        if _model is None or force_cpu:
            from faster_whisper import WhisperModel

            device, compute = ("cpu", "int8") if force_cpu else (settings.device, settings.compute_type)
            log.info("Nạp Whisper model=%s device=%s compute=%s", settings.model, device, compute)
            try:
                _model = WhisperModel(settings.model, device=device, compute_type=compute)
            except RuntimeError as err:
                if device == "cpu" or not is_cuda_error(err):
                    raise
                log.warning("Không dùng được GPU (%s): chạy Whisper trên CPU", err)
                gpu_watch.mark_lost(err)
                _model = WhisperModel(settings.model, device="cpu", compute_type="int8")
        return _model


# Tham số giải mã chung: không mượn ngữ cảnh câu trước (tránh lặp vòng) và bỏ
# đoạn bịa giữa khoảng lặng dài (cần word_timestamps).
DECODE = {"condition_on_previous_text": False, "word_timestamps": True, "hallucination_silence_threshold": 2.0}


class WhisperTranscriber:
    def __init__(self, settings: Settings | None = None, model: Any = None, diarizer: Any = None) -> None:
        self.settings = settings or Settings.from_env()
        self._model = model
        self._diarizer = diarizer
        self.diarize = diarizer is not None or os.environ.get("AI_DIARIZATION", "1") not in ("0", "false")

    @property
    def model(self):
        if self._model is None:
            self._model = _load_model(self.settings)
        return self._model

    async def transcribe(
        self, bucket: str, object_key: str, language: str, voice_profiles: list[dict] | None = None
    ) -> TranscriptResult:
        # Whisper chạy CPU nặng: đẩy sang thread để không chặn vòng lặp RabbitMQ
        # (heartbeat mất thì broker cắt kết nối giữa chừng).
        path = await asyncio.to_thread(download_to_temp, bucket, object_key)
        try:
            from faster_whisper import decode_audio

            audio = await asyncio.to_thread(decode_audio, str(path), SAMPLE_RATE)
            try:
                return await asyncio.to_thread(self.transcribe_audio, audio, language, voice_profiles)
            except RuntimeError as err:
                # GPU mất giữa chừng (model đã nạp lên GPU không dùng được nữa):
                # nạp lại trên CPU và chạy lại bản ghi này một lần.
                if not is_cuda_error(err) or self.settings.device == "cpu":
                    raise
                log.warning("GPU lỗi khi phiên âm (%s): chuyển Whisper sang CPU và chạy lại", err)
                gpu_watch.mark_lost(err)
                self._model = await asyncio.to_thread(_load_model, self.settings, True)
                return await asyncio.to_thread(self.transcribe_audio, audio, language, voice_profiles)
        finally:
            path.unlink(missing_ok=True)

    def transcribe_audio(self, audio, hint: str | None, voice_profiles: list[dict] | None = None) -> TranscriptResult:
        """Phần lõi, nhận audio đã giải mã (numpy float32, 16 kHz mono)."""
        s = self.settings
        # Bản ghi bị đục (bot Meet có buổi mất dải 1–4 kHz) được cân bằng lại cho phần
        # nhận dạng chữ; tách người nói vẫn nghe âm thanh gốc (equalize.py).
        original = audio
        audio, _ = equalize(audio)
        # Nhận ngôn ngữ chính trên phần có tiếng nói, không phải 30 giây đầu (có thể lặng).
        detected, probability, _ = self.model.detect_language(speech_probe(audio))
        base = choose_base_language(detected, probability, hint, s.base_min_prob)
        log.info(
            "Ngôn ngữ nhận diện: %s (%.2f), gợi ý: %s → ngôn ngữ chính: %s",
            detected,
            probability,
            hint,
            base,
        )

        first_pass, info = self.model.transcribe(
            audio, language=base, beam_size=s.beam_size, **speech_filter(audio), **DECODE
        )
        # Không nhận diện được và Core không gợi ý: lấy ngôn ngữ Whisper tự chọn.
        base = base or info.language

        words: list[Word] = []
        # Từ của Whisper trước lượt sửa: ranh giới các khúc tách người nói lấy theo đây,
        # để đổi mô hình sửa từ không làm đổi kết quả tách người nói (với gipformer, buổi
        # học 2 người từng ra 3 người chỉ vì ranh giới từ xê dịch).
        heard: list[Word] = []
        confidences: dict[int, float | None] = {}
        previous = base
        for index, seg in enumerate(first_pass):
            text = seg.text.strip()
            if not text or is_hallucination(text):
                continue
            clip = audio[int(seg.start * SAMPLE_RATE) : int(seg.end * SAMPLE_RATE)]
            duration = seg.end - seg.start

            guess = None
            if duration >= s.min_detect_seconds:
                lang, prob, _ = self.model.detect_language(clip)
                guess = (lang, prob)
            language = choose_segment_language(base, previous, duration, guess, s)

            seg_words = [(w.start, w.end, w.word) for w in (seg.words or [])] or [(seg.start, seg.end, " " + text)]
            # Độ tự tin từng từ của Whisper, để lượt sửa chỉ thay khi mô hình tiếng Việt chắc hơn.
            seg_probs = [float(getattr(w, "probability", 1.0)) for w in (seg.words or [])] or None
            confidence = confidence_of(seg.avg_logprob)
            if language != base:
                redo_words, redo_conf = self._retranscribe(clip, language)
                if redo_words and not plausible_switch(language, base, redo_words, duration):
                    # Chép lại bằng ngôn ngữ kia mà ra chữ tiếng Việt, hoặc chỉ vài chữ cho cả
                    # một đoạn dài: đoạn này thật ra là ngôn ngữ chính, Whisper nhận nhầm.
                    redo_words, language = [], base
                if redo_words:
                    # Mốc của lần phiên âm lại tính từ đầu đoạn cắt.
                    seg_words = [(seg.start + a, seg.start + b, t) for a, b, t in redo_words]
                    seg_probs = None
                    confidence = redo_conf
                else:
                    # Phiên âm lại không ra chữ: giữ bản lượt đầu và ngôn ngữ chính.
                    language = base

            heard.extend(Word(a, b, t, language, index) for a, b, t in seg_words)
            if language == "vi" and refine.enabled():
                # Mô hình chuyên tiếng Việt nghe lại câu này và sửa từ sai (refine.py).
                pad = int(0.15 * SAMPLE_RATE)
                a0 = max(0, int(seg.start * SAMPLE_RATE) - pad)
                seg_words = refine.refine_words(
                    audio[a0 : int(seg.end * SAMPLE_RATE) + pad], a0 / SAMPLE_RATE, seg_words, s.device, s.compute_type, seg_probs
                )

            confidences[index] = confidence
            words.extend(Word(a, b, t, language, index) for a, b, t in seg_words)
            previous = language

        turns, centroids = self._turns(original, heard) if self.diarize and heard else ([], {})
        speaker_matches: dict = {}
        if turns:
            label_of: dict[int, str] = {}
            segments = build_segments(words, turns, confidences, labels_out=label_of)
            if voice_profiles and centroids:
                speaker_matches = self._match_voices(centroids, label_of, voice_profiles)
        else:
            segments = build_segments(words, [], confidences)
            for seg in segments:
                seg["speakerLabel"] = SPEAKER_LABEL

        breakdown = language_breakdown(segments)
        dominant = next(iter(breakdown), base)
        return TranscriptResult(
            run_id=str(uuid.uuid4()),
            model=f"faster-whisper/{s.model}" + ("+sherpa-onnx" if turns else ""),
            segments=segments,
            language=dominant,
            languages=breakdown,
            speaker_matches=speaker_matches,
        )

    def _turns(self, audio, words: list[Word]):
        """Lượt nói của từng người kèm vân giọng từng người; lỗi thì vẫn trả
        transcript, chỉ không tách người."""
        try:
            diarizer = self._diarizer or _load_diarizer()
            if hasattr(diarizer, "diarize"):
                turns, centroids = diarizer.diarize(audio, words, SAMPLE_RATE)
            else:
                turns, centroids = diarizer.turns(audio, words, SAMPLE_RATE), {}
            people = {t.speaker for t in turns if t.speaker >= 0}
            log.info("Tách người nói: %d khúc, %d người", len(turns), len(people))
            return turns, centroids
        except Exception:  # noqa: BLE001 - tách người nói là phần thêm, không được làm hỏng phiên âm
            log.exception("Tách người nói lỗi, giữ một nhãn chung")
            return [], {}

    def _match_voices(self, centroids: dict, label_of: dict[int, str], profiles: list[dict]) -> dict:
        """Ghép "Người nói N" với người tham dự đã đăng ký giọng; lỗi thì bỏ qua, không hỏng phiên âm."""
        try:
            from app.worker import voice

            by_label = {label_of[k]: c for k, c in centroids.items() if k in label_of}
            matches = voice.match(by_label, profiles, voice.match_threshold())
            log.info(
                "Nhận ra theo giọng %d/%d người nói (%d người đã đăng ký giọng): %s",
                len(matches),
                len(by_label),
                len(profiles),
                {label: m["score"] for label, m in matches.items()},
            )
            return matches
        except Exception:  # noqa: BLE001
            log.exception("Ghép vân giọng lỗi, giữ nhãn Người nói N")
            return {}

    def _retranscribe(self, clip, language: str) -> tuple[list[tuple[float, float, str]], float | None]:
        """Phiên âm lại một đoạn bằng đúng ngôn ngữ của nó; trả từ kèm mốc (tính từ đầu đoạn)."""
        parts, _ = self.model.transcribe(clip, language=language, beam_size=self.settings.beam_size, **DECODE)
        parts = [p for p in parts if p.text.strip() and not is_hallucination(p.text)]
        words: list[tuple[float, float, str]] = []
        for p in parts:
            if p.words:
                words.extend((w.start, w.end, w.word) for w in p.words)
            else:
                words.append((p.start, p.end, " " + p.text.strip()))
        logprobs = [p.avg_logprob for p in parts if p.avg_logprob is not None]
        return words, confidence_of(sum(logprobs) / len(logprobs)) if logprobs else None
