"""Vân giọng (speaker embedding): nhận ra người nói đã đăng ký giọng.

Dùng đúng model 3D-Speaker của bước tách người nói (diarizer.py), nên vân giọng
lúc đăng ký và vân giọng tính từ cuộc họp so được với nhau bằng cosine. Chỉ giữ
vector, không giữ âm thanh mẫu.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

from app.worker.diarizer import EMBEDDING_NAME, ensure_model

log = logging.getLogger("ai-worker")

MODEL = f"sherpa-onnx/{EMBEDDING_NAME}"
SAMPLE_RATE = 16000
# Mỗi mẫu cần đủ giọng nói (sau khi bỏ khoảng lặng) để vân giọng ổn định.
MIN_SAMPLE_SECONDS = 3.0
MAX_SAMPLES = 5
# Chấm chất lượng để admin xác nhận mẫu: ít giọng nói quá hoặc nền ồn thì vân
# giọng kém tin cậy (dễ nhận nhầm người).
GOOD_TOTAL_SECONDS = 9.0
GOOD_SNR_DB = 15.0
# Một câu trong lúc ghi trực tiếp: ngắn hơn ngần này giọng nói thì vân giọng
# không đáng tin, để giao diện giữ người nói trước đó.
MIN_UTTERANCE_SECONDS = 1.0

_extractor = None
_lock = threading.Lock()


def match_threshold() -> float:
    """Cosine tối thiểu để coi là cùng một người; dưới mức này giữ "Người nói N"."""
    return float(os.environ.get("AI_VOICE_MATCH_THRESHOLD", "0.5"))


def _extractor_instance():
    global _extractor
    with _lock:
        if _extractor is None:
            import sherpa_onnx

            _extractor = sherpa_onnx.SpeakerEmbeddingExtractor(
                sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                    model=str(ensure_model()), num_threads=int(os.environ.get("AI_DIARIZATION_THREADS", "2"))
                )
            )
        return _extractor


def normalize(vector):
    import numpy as np

    v = np.asarray(vector, dtype=np.float32)
    norm = float(np.linalg.norm(v))
    return v / norm if norm > 0 else v


def voiced(audio, frame_s: float = 0.025):
    """Bỏ khoảng lặng: giữ khung có năng lượng đáng kể so với phần to nhất của mẫu."""
    import numpy as np

    audio = np.asarray(audio, dtype=np.float32)
    size = int(frame_s * SAMPLE_RATE)
    if len(audio) < size:
        return audio[:0]
    frames = audio[: len(audio) // size * size].reshape(-1, size)
    rms = np.sqrt((frames**2).mean(axis=1))
    floor = max(0.01, 0.1 * float(np.percentile(rms, 95)))
    return frames[rms > floor].reshape(-1)


def snr_db(audio, frame_s: float = 0.025) -> float:
    """Ước lượng tỉ lệ tín hiệu/nhiễu: khung to (giọng) so với khung nhỏ nhất (nền)."""
    import numpy as np

    audio = np.asarray(audio, dtype=np.float32)
    size = int(frame_s * SAMPLE_RATE)
    if len(audio) < size * 4:
        return 0.0
    frames = audio[: len(audio) // size * size].reshape(-1, size)
    rms = np.sqrt((frames**2).mean(axis=1))
    speech = float(np.percentile(rms, 90))
    noise = max(float(np.percentile(rms, 10)), 1e-4)
    return 20.0 * float(np.log10(max(speech, 1e-4) / noise))


def quality(total_seconds: float, snrs: list[float]) -> str:
    """good | short | noisy — hiện cho admin khi xác nhận mẫu giọng."""
    if total_seconds < GOOD_TOTAL_SECONDS:
        return "short"
    if snrs and min(snrs) < GOOD_SNR_DB:
        return "noisy"
    return "good"


def embed(audio):
    stream = _extractor_instance().create_stream()
    stream.accept_waveform(SAMPLE_RATE, audio)
    stream.input_finished()
    return normalize(_extractor_instance().compute(stream))


def embed_utterance(audio) -> tuple[list[float], float] | None:
    """Vân giọng của một câu nói (phiên âm trực tiếp); câu quá ít giọng nói thì None."""
    speech = voiced(audio)
    seconds = len(speech) / SAMPLE_RATE
    if seconds < MIN_UTTERANCE_SECONDS:
        return None
    return embed(speech).tolist(), round(seconds, 2)


def enroll(samples: list[Any]) -> tuple[list[float], float, str]:
    """Vân giọng của một người từ vài mẫu đọc: trung bình vân giọng từng mẫu.

    Mẫu quá ngắn hoặc quá nhỏ (ít giọng nói) bị từ chối thay vì cho ra vân
    giọng kém dẫn tới nhận nhầm người.
    """
    import numpy as np

    if not samples:
        raise ValueError("Cần ít nhất một mẫu giọng")
    if len(samples) > MAX_SAMPLES:
        raise ValueError(f"Tối đa {MAX_SAMPLES} mẫu giọng")
    vectors = []
    total = 0.0
    snrs = []
    for index, audio in enumerate(samples, start=1):
        snrs.append(snr_db(audio))
        speech = voiced(audio)
        seconds = len(speech) / SAMPLE_RATE
        if seconds < MIN_SAMPLE_SECONDS:
            raise ValueError(
                f"Mẫu {index} chỉ có {seconds:.1f} giây giọng nói (cần ít nhất {MIN_SAMPLE_SECONDS:.0f} giây). "
                "Đọc to, rõ và gần micro hơn."
            )
        vectors.append(embed(speech))
        total += seconds
    return normalize(np.mean(vectors, axis=0)).tolist(), round(total, 1), quality(total, snrs)


def match(centroids: dict[str, Any], profiles: list[dict[str, Any]], threshold: float) -> dict[str, dict[str, Any]]:
    """Ghép nhãn "Người nói N" với người đã đăng ký giọng.

    Xét cặp giống nhất trước; mỗi người chỉ ứng với một nhãn và ngược lại (hai
    người khác nhau không thể là cùng một giọng). Dưới ngưỡng thì không ghép.
    """
    import numpy as np

    pairs: list[tuple[float, str, str]] = []
    for label, centroid in centroids.items():
        c = normalize(centroid)
        for profile in profiles:
            e = normalize(profile.get("embedding") or [])
            if e.shape != c.shape:
                continue
            pairs.append((float(np.dot(c, e)), label, str(profile["userId"])))
    pairs.sort(key=lambda p: p[0], reverse=True)

    result: dict[str, dict[str, Any]] = {}
    used_users: set[str] = set()
    for score, label, user in pairs:
        if score < threshold:
            break
        if label in result or user in used_users:
            continue
        result[label] = {"userId": user, "score": round(score, 3)}
        used_users.add(user)
    return result
