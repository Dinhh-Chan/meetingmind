"""Tách người nói (ai nói khi nào) cho bản ghi một micro — họp trực tiếp.

Whisper chỉ chép lời, không phân biệt giọng. Cách làm: cắt lời Whisper thành
khúc ~1,5 s theo ranh giới từ, tính vector giọng từng khúc bằng mô hình
3D-Speaker (ONNX qua sherpa-onnx, CPU, không cần token), rồi gộp cụm theo độ
giống nhau — chỉ khúc từ 1 s trở lên, khúc ngắn hơn theo người giống nhất.
Khúc giống gần ngang hai người được coi là nói chồng.

Không dùng mô hình phân đoạn pyannote: trên dữ liệu thử nó coi cả cửa sổ 10 s
là một người, chỉ "đổi người" ở ranh giới cửa sổ, trong khi vector giọng tách
người rất rõ (cùng người ~0,6, khác người ~0,2).

Kết quả chỉ là "Người nói 1, 2…": biết là ai thì người dùng gắn tên ở màn
transcript, hoặc sau này gợi ý qua mẫu giọng tự nguyện (PROJECT_OVERVIEW §6.5).
"""

import logging
import os
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

log = logging.getLogger("ai-worker")

RELEASES = "https://github.com/k2-fsa/sherpa-onnx/releases/download"
EMBEDDING_NAME = "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
# Tên thư mục release của sherpa-onnx viết sai chính tả sẵn ("recongition").
EMBEDDING_URL = f"{RELEASES}/speaker-recongition-models/{EMBEDDING_NAME}"


@dataclass(frozen=True)
class Turn:
    start: float
    end: float
    speaker: int


@dataclass(frozen=True)
class Word:
    start: float
    end: float
    text: str
    language: str
    segment: int  # chỉ số đoạn Whisper chứa từ này


# ---------- Ghép lời Whisper với lượt nói: hàm thuần, test không cần model ----------


def overlap_regions(turns: list[Turn]) -> list[tuple[float, float]]:
    """Khoảng thời gian có từ hai người nói trở lên cùng lúc."""
    events = sorted([(t.start, 1) for t in turns] + [(t.end, -1) for t in turns])
    regions, active, start = [], 0, 0.0
    for time, delta in events:
        before = active
        active += delta
        if before < 2 <= active:
            start = time
        elif before >= 2 > active and time > start:
            regions.append((start, time))
    return regions


def _overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def speaker_of(word: Word, turns: list[Turn], previous: int | None) -> int | None:
    """Người nói của một từ: lượt nói phủ từ đó nhiều nhất.

    Từ rơi vào khe hở giữa các lượt (mô hình phân đoạn bỏ sót đoạn ngắn) thì
    theo lượt gần nhất trong 1 giây, xa hơn nữa thì theo từ đứng trước.
    """
    best, best_len = None, 0.0
    for t in turns:
        length = _overlap(word.start, word.end, t.start, t.end)
        if length > best_len:
            best, best_len = t.speaker, length
    if best is not None:
        return best
    mid = (word.start + word.end) / 2
    nearest = min(turns, key=lambda t: min(abs(mid - t.start), abs(mid - t.end)), default=None)
    if nearest and min(abs(mid - nearest.start), abs(mid - nearest.end)) <= 1.0:
        return nearest.speaker
    return previous


def build_segments(
    words: list[Word],
    turns: list[Turn],
    confidences: dict[int, float | None],
    min_overlap_s: float = 0.3,
    labels_out: dict[int, str] | None = None,
) -> list[dict[str, Any]]:
    """Cắt lời thành đoạn theo người nói.

    Một đoạn Whisper trùm hai người (người này dứt lời, người kia nói ngay) bị
    cắt đôi đúng chỗ đổi người. Nhãn đặt theo thứ tự xuất hiện: "Người nói 1"
    là người mở lời trước. Truyền labels_out để lấy bảng số người → nhãn (dùng
    khi ghép vân giọng với người đã đăng ký).
    """
    regions = overlap_regions(turns)
    labels: dict[int, str] = {}
    segments: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    previous: int | None = None

    for w in words:
        speaker = speaker_of(w, turns, previous)
        previous = speaker
        if speaker is not None and speaker not in labels:
            labels[speaker] = f"Người nói {len(labels) + 1}"
        label = labels.get(speaker, "Người nói 1")
        if (
            current is None
            or current["speakerLabel"] != label
            or current["_segment"] != w.segment
            or current["language"] != w.language
        ):
            current = {
                "speakerLabel": label,
                "startMs": int(w.start * 1000),
                "endMs": int(w.end * 1000),
                "text": "",
                "confidence": confidences.get(w.segment),
                "language": w.language,
                "_segment": w.segment,
            }
            segments.append(current)
        current["text"] += w.text
        current["endMs"] = int(w.end * 1000)

    for s in segments:
        s.pop("_segment")
        s["text"] = s["text"].strip()
        start, end = s["startMs"] / 1000, s["endMs"] / 1000
        overlapped = sum(_overlap(start, end, r0, r1) for r0, r1 in regions)
        # Nói chồng đáng kể: đủ dài, hoặc chiếm phần lớn một đoạn ngắn.
        # bool(): mốc từ của faster-whisper là numpy.float64, so sánh ra numpy.bool.
        s["isOverlapping"] = bool(overlapped >= min_overlap_s or (end > start and overlapped / (end - start) >= 0.3))
    if labels_out is not None:
        labels_out.update(labels)
    return [s for s in segments if s["text"]]


# ---------- Cắt khúc và gộp cụm: hàm thuần ----------


@dataclass(frozen=True)
class Window:
    start: float
    end: float


def make_windows(words: list[Word], target_s: float = 1.5, max_gap_s: float = 0.4) -> list[Window]:
    """Khúc ~target_s theo ranh giới từ; khoảng lặng dài hay sang đoạn Whisper
    mới thì cắt khúc (thường là chỗ đổi người)."""
    windows: list[Window] = []
    start = end = None
    segment = None
    for w in words:
        if start is not None and (w.start - end > max_gap_s or w.segment != segment or end - start >= target_s):
            windows.append(Window(start, end))
            start = None
        if start is None:
            start, segment = w.start, w.segment
        end = w.end
    if start is not None:
        windows.append(Window(start, end))
    return windows


def _normalize(m):
    import numpy as np

    return m / np.maximum(np.linalg.norm(m, axis=1, keepdims=True), 1e-9)


def cluster(embeddings, threshold: float, max_speakers: int = 20) -> list[int]:
    """Gộp cụm từ dưới lên (average linkage, cosine): ghép hai cụm giống nhau
    nhất cho tới khi không còn cặp nào giống hơn ngưỡng. Số người tự suy ra."""
    import numpy as np

    n = len(embeddings)
    if n == 0:
        return []
    x = _normalize(np.asarray(embeddings, dtype=np.float32))
    sim = x @ x.T
    np.fill_diagonal(sim, -np.inf)
    sizes = np.ones(n)
    members = {i: [i] for i in range(n)}
    alive = np.ones(n, dtype=bool)
    while alive.sum() > 1:
        i, j = np.unravel_index(np.argmax(sim), sim.shape)
        if sim[i, j] < threshold and alive.sum() <= max_speakers:
            break
        # Average linkage: độ giống của cụm gộp là trung bình có trọng số.
        merged = (sim[i] * sizes[i] + sim[j] * sizes[j]) / (sizes[i] + sizes[j])
        sim[i, :] = merged
        sim[:, i] = merged
        sim[i, i] = -np.inf
        sim[j, :] = -np.inf
        sim[:, j] = -np.inf
        sizes[i] += sizes[j]
        alive[j] = False
        members[i] += members.pop(j)
    labels = [0] * n
    for label, idx in enumerate(sorted(members.values(), key=min)):
        for k in idx:
            labels[k] = label
    return labels


def cluster_reliable(embeddings, durations: list[float], threshold: float, min_window_s: float) -> list[int]:
    """Gộp cụm chỉ trên các khúc đủ dài; khúc ngắn theo cụm có tâm giống nhất.

    Khúc ngắn ("alo", "ừ" dưới 1 s) cho vân giọng nhiễu, và vài khúc ngắn của
    cùng một người dễ giống nhau hơn giống phần nói dài của chính người đó —
    để chúng tham gia gộp cụm thì đẻ ra "người nói" thừa (bản ghi thật hai người
    nói ra ba người). Không đủ hai khúc dài thì gộp cụm tất cả như cũ.
    """
    import numpy as np

    reliable = [i for i, d in enumerate(durations) if d >= min_window_s]
    if len(reliable) < 2:
        return cluster(embeddings, threshold)
    x = _normalize(np.asarray(embeddings, dtype=np.float32))
    labels = np.full(len(x), -1)
    labels[reliable] = cluster(x[reliable], threshold)
    ks = sorted(set(labels[reliable].tolist()))
    centroids = _normalize(np.stack([x[labels == k].mean(0) for k in ks]))
    for i in np.flatnonzero(labels < 0):
        labels[i] = ks[int(np.argmax(centroids @ x[i]))]
    # Đánh số lại theo thứ tự xuất hiện, như cluster().
    order: dict[int, int] = {}
    for k in labels.tolist():
        order.setdefault(k, len(order))
    return [order[k] for k in labels.tolist()]


def merge_small_clusters(embeddings, labels: list[int], durations: list[float], min_speaker_s: float) -> list[int]:
    """Cụm có tổng thời gian nói quá ít gộp vào cụm lớn giống nhất.

    Thu âm ồn, khúc ngắn cho vector giọng nhiễu và hay đẻ ra "người nói" ảo chỉ
    vài giây. Đánh đổi: người chỉ nói một câu "ok" có thể bị gộp vào người khác.
    """
    import numpy as np

    if not labels:
        return labels
    total = {}
    for k, d in zip(labels, durations):
        total[k] = total.get(k, 0.0) + d
    big = [k for k, t in total.items() if t >= min_speaker_s]
    if not big or len(big) == len(total):
        return labels
    x = _normalize(np.asarray(embeddings, dtype=np.float32))
    lab = np.array(labels)
    centroids = {k: _normalize(x[lab == k].mean(0, keepdims=True))[0] for k in total}
    remap = {k: (k if k in big else max(big, key=lambda b: float(centroids[k] @ centroids[b]))) for k in total}
    # Đánh số lại liên tục theo thứ tự xuất hiện.
    order: dict[int, int] = {}
    for k in labels:
        order.setdefault(remap[k], len(order))
    return [order[remap[k]] for k in labels]


def overlap_windows(embeddings, labels: list[int], k: float = 2.0, floor: float = 0.3, min_windows: int = 6) -> list[bool]:
    """Khúc có dấu hiệu nói chồng: giống người thứ hai cao bất thường.

    Khi hai người nói chồng, giọng át vẫn trội nhưng độ giống với người kia
    nhích lên. Mức "bình thường" khác nhau theo bản ghi (ồn thì mọi khúc giống
    nhau hơn) nên so với chính bản ghi: vượt trung vị + k × MAD mới đánh dấu.

    Đo trên dữ liệu thử: bắt được 2/6 khúc chồng, báo nhầm 2/49 khúc thường —
    chỉ là gợi ý "nên nghe lại" (Whisper chép giọng át và bỏ mất lời người kia),
    không phải phát hiện đáng tin. Ghi âm một micro không tách được nói chồng.
    """
    import numpy as np

    if not labels or max(labels) == 0 or len(labels) < min_windows:
        return [False] * len(labels)
    x = _normalize(np.asarray(embeddings, dtype=np.float32))
    lab = np.array(labels)
    centroids = _normalize(np.stack([x[lab == c].mean(0) for c in range(max(labels) + 1)]))
    second = np.sort(x @ centroids.T, axis=1)[:, ::-1][:, 1]
    median = float(np.median(second))
    mad = float(np.median(np.abs(second - median)))
    threshold = max(floor, median + k * mad)
    return [bool(v > threshold) for v in second]


def turns_from_windows(windows: list[Window], labels: list[int], overlapping: list[bool]) -> list[Turn]:
    """Lượt nói từ khúc đã gán người. Khúc nói chồng sinh thêm một lượt trùng giờ
    để overlap_regions() thấy được."""
    turns = [Turn(w.start, w.end, k) for w, k in zip(windows, labels)]
    turns += [Turn(w.start, w.end, -1) for w, o in zip(windows, overlapping) if o]
    return turns


# ---------- Model ----------


def _models_dir() -> Path:
    # Nằm trong volume whisper-models để không tải lại khi dựng lại container.
    return Path(os.environ.get("AI_DIARIZATION_MODELS_DIR", "/root/.cache/huggingface/sherpa-onnx"))


def ensure_model() -> Path:
    root = _models_dir()
    root.mkdir(parents=True, exist_ok=True)
    embedding = root / EMBEDDING_NAME
    if not embedding.exists():
        log.info("Tải mô hình nhúng giọng %s", EMBEDDING_NAME)
        urllib.request.urlretrieve(EMBEDDING_URL, embedding)
    return embedding


class Diarizer:
    def __init__(self, threshold: float | None = None) -> None:
        import sherpa_onnx

        self.threshold = threshold if threshold is not None else float(os.environ.get("AI_DIARIZATION_THRESHOLD", "0.3"))
        self.min_speaker_s = float(os.environ.get("AI_DIARIZATION_MIN_SPEAKER_S", "2.0"))
        self.min_window_s = float(os.environ.get("AI_DIARIZATION_MIN_WINDOW_S", "1.0"))
        # Đánh dấu nói chồng mặc định tắt: thực nghiệm trên bản ghi 4 người cho
        # thấy ngưỡng tương đối báo nhầm 8–11 đoạn trên bản ghi không có nói
        # chồng và không bắt được đoạn chồng ngắn 1,2 s. Bật để thử nghiệm tiếp.
        self.detect_overlap = os.environ.get("AI_DIARIZATION_OVERLAP", "0") in ("1", "true")
        self._extractor = sherpa_onnx.SpeakerEmbeddingExtractor(
            sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                model=str(ensure_model()), num_threads=int(os.environ.get("AI_DIARIZATION_THREADS", "2"))
            )
        )

    def _embed(self, audio, window: Window, sample_rate: int):
        import numpy as np

        # Nới 0,1 s hai đầu: mốc từ của Whisper hay cắt sát.
        a = max(0, int((window.start - 0.1) * sample_rate))
        b = min(len(audio), int((window.end + 0.1) * sample_rate))
        stream = self._extractor.create_stream()
        stream.accept_waveform(sample_rate, audio[a:b])
        stream.input_finished()
        return np.array(self._extractor.compute(stream))

    def turns(self, audio, words: list[Word], sample_rate: int = 16000) -> list[Turn]:
        return self.diarize(audio, words, sample_rate)[0]

    def diarize(self, audio, words: list[Word], sample_rate: int = 16000):
        """Lượt nói, kèm vân giọng trung bình của từng người (để nhận ra người đã đăng ký giọng)."""
        import numpy as np

        windows = make_windows(words)
        if not windows:
            return [], {}
        embeddings = [self._embed(audio, w, sample_rate) for w in windows]
        durations = [w.end - w.start for w in windows]
        labels = cluster_reliable(embeddings, durations, self.threshold, self.min_window_s)
        labels = merge_small_clusters(embeddings, labels, durations, self.min_speaker_s)
        if self.detect_overlap:
            overlapping = overlap_windows(embeddings, labels)
        else:
            overlapping = [False] * len(windows)
        x = _normalize(np.asarray(embeddings, dtype=np.float32))
        centroids = {k: x[[i for i, label in enumerate(labels) if label == k]].mean(axis=0) for k in set(labels) if k >= 0}
        return turns_from_windows(windows, labels, overlapping), centroids
