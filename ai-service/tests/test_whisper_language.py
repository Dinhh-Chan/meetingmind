"""Nhận diện ngôn ngữ theo đoạn của WhisperTranscriber, với model giả.

Model giả "nghe" ngôn ngữ qua biên độ audio: 0.2 là tiếng Việt, 0.8 là tiếng
Anh. Lượt đầu nó giải mã mọi đoạn bằng ngôn ngữ được ép (như Whisper thật),
nên đoạn tiếng Anh ra chữ sai cho tới khi được phiên âm lại.
"""

import asyncio
from types import SimpleNamespace

import numpy as np

from app.worker.whisper_transcriber import (
    SAMPLE_RATE,
    Settings,
    WhisperTranscriber,
    choose_base_language,
    choose_segment_language,
    language_breakdown,
)

VI, EN = 0.2, 0.8


def build_audio(parts):
    """parts: [(giây, biên độ)] → audio và danh sách (start, end) theo giây."""
    chunks, spans, t = [], [], 0.0
    for seconds, level in parts:
        chunks.append(np.full(int(seconds * SAMPLE_RATE), level, dtype=np.float32))
        spans.append((t, t + seconds))
        t += seconds
    return np.concatenate(chunks), spans


class FakeModel:
    def __init__(self, spans, audio_len, low_confidence=False):
        self.spans = spans
        self.audio_len = audio_len
        self.low_confidence = low_confidence
        self.retranscribed = []

    def _lang(self, clip):
        return "en" if float(np.mean(clip)) > 0.5 else "vi"

    def detect_language(self, audio):
        # 0.4: dưới cả ngưỡng ngôn ngữ chính (0.5) lẫn ngưỡng đổi đoạn (0.7).
        prob = 0.4 if self.low_confidence else 0.95
        return self._lang(audio), prob, []

    def transcribe(self, audio, language=None, **kwargs):
        if len(audio) == self.audio_len:
            # Lượt đầu: ép cả bài bằng `language`.
            segs = []
            for start, end in self.spans:
                clip = audio[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
                spoken = self._lang(clip)
                text = f"{spoken} đúng" if spoken == language else "chữ sai"
                segs.append(SimpleNamespace(start=start, end=end, text=f" {text} ", avg_logprob=-0.1, words=None))
            return iter(segs), SimpleNamespace(language=language or "vi")
        self.retranscribed.append(language)
        spoken = self._lang(audio)
        text = f"{spoken} đúng" if spoken == language else "chữ sai"
        # Như Whisper thật: mốc tính từ đầu đoạn cắt và phủ hết đoạn đó.
        end = len(audio) / SAMPLE_RATE
        return iter([SimpleNamespace(start=0, end=end, text=text, avg_logprob=-0.2, words=None)]), SimpleNamespace(language=language)


def run(parts, hint="vi", **settings):
    audio, spans = build_audio(parts)
    model = FakeModel(spans, len(audio), low_confidence=settings.pop("low_confidence", False))
    transcriber = WhisperTranscriber(Settings(**settings), model=model)
    transcriber.diarize = False  # tách người nói có test riêng
    result = transcriber.transcribe_audio(audio, hint)
    return result, model


def test_cuoc_hop_noi_lan_viet_anh():
    result, model = run([(4, VI), (3, EN), (5, VI)])
    assert [s["language"] for s in result.segments] == ["vi", "en", "vi"]
    # Đoạn tiếng Anh được phiên âm lại bằng tiếng Anh, không còn "chữ sai".
    assert [s["text"] for s in result.segments] == ["vi đúng", "en đúng", "vi đúng"]
    assert model.retranscribed == ["en"]
    assert result.language == "vi"
    assert result.languages == {"vi": 0.75, "en": 0.25}


def test_toan_tieng_anh_du_cuoc_hop_de_vi():
    # Core gửi "vi" mặc định, nhưng audio toàn tiếng Anh và nhận diện chắc chắn.
    result, model = run([(5, EN), (5, EN)])
    assert result.language == "en"
    assert {s["language"] for s in result.segments} == {"en"}
    assert model.retranscribed == []


def test_doan_ngan_giu_ngon_ngu_doan_truoc():
    # Đoạn tiếng Anh 1 giây quá ngắn để nhận diện: theo đoạn trước.
    result, _ = run([(4, VI), (1, EN), (4, VI)])
    assert [s["language"] for s in result.segments] == ["vi", "vi", "vi"]


def test_nhan_dien_khong_chac_thi_theo_goi_y():
    result, model = run([(4, EN), (4, EN)], hint="vi", low_confidence=True)
    assert result.language == "vi"
    assert model.retranscribed == []


def test_choose_base_language():
    assert choose_base_language("en", 0.9, "vi", 0.5) == "en"
    assert choose_base_language("en", 0.3, "vi", 0.5) == "vi"
    assert choose_base_language("en", 0.3, None, 0.5) == "en"


def test_choose_segment_language():
    s = Settings(segment_min_prob=0.7, min_detect_seconds=1.5)
    assert choose_segment_language("vi", "vi", 3, ("en", 0.9), s) == "en"
    assert choose_segment_language("vi", "en", 1, ("vi", 0.99), s) == "en"
    assert choose_segment_language("vi", "en", 3, ("ja", 0.4), s) == "vi"


def test_language_breakdown():
    segs = [
        {"startMs": 0, "endMs": 3000, "language": "vi"},
        {"startMs": 3000, "endMs": 4000, "language": "en"},
    ]
    assert language_breakdown(segs) == {"vi": 0.75, "en": 0.25}
    assert language_breakdown([]) == {}


def test_stub_van_tra_ngon_ngu():
    from app.worker.transcriber import StubTranscriber

    result = asyncio.run(StubTranscriber().transcribe("b", "k", "vi"))
    assert result.language == "vi"
    assert all(s["language"] == "vi" for s in result.segments)
