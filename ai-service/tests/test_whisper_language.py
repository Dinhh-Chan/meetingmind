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
# Chữ "chép đúng" của từng ngôn ngữ: đủ dày (≥ 1 từ/giây) như lời nói thật.
RIGHT = {"vi": "tiếng việt chép đúng từng chữ", "en": "english transcribed correctly word by word"}


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
        # Chữ trả về khi phiên âm lại một đoạn (None: chép đúng theo ngôn ngữ thật).
        self.redo_text = None

    def _lang(self, clip):
        return "en" if float(np.mean(clip)) > 0.5 else "vi"

    def detect_language(self, audio):
        # 0.4: dưới cả ngưỡng ngôn ngữ chính (0.8) lẫn ngưỡng đổi đoạn (0.9).
        prob = 0.4 if self.low_confidence else 0.95
        return self._lang(audio), prob, []

    def transcribe(self, audio, language=None, **kwargs):
        if len(audio) == self.audio_len:
            # Lượt đầu: ép cả bài bằng `language`.
            segs = []
            for start, end in self.spans:
                clip = audio[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
                spoken = self._lang(clip)
                text = RIGHT[spoken] if spoken == language else "chữ sai"
                segs.append(SimpleNamespace(start=start, end=end, text=f" {text} ", avg_logprob=-0.1, words=None))
            return iter(segs), SimpleNamespace(language=language or "vi")
        self.retranscribed.append(language)
        spoken = self._lang(audio)
        text = self.redo_text or (RIGHT[spoken] if spoken == language else "chữ sai")
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
    assert [s["text"] for s in result.segments] == [RIGHT["vi"], RIGHT["en"], RIGHT["vi"]]
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


def test_doan_khong_doi_sang_ngon_ngu_la():
    s = Settings()
    # Whisper "chắc" một đoạn tiếng Việt là tiếng Tây Ban Nha: giữ ngôn ngữ chính.
    assert choose_segment_language("vi", "vi", 3, ("es", 0.95), s) == "vi"
    assert choose_segment_language("vi", "en", 3, ("id", 0.9), s) == "vi"
    # Ngôn ngữ chính của bài luôn được phép, kể cả khi không nằm trong danh sách xen.
    assert choose_segment_language("ja", "en", 3, ("ja", 0.9), s) == "ja"
    assert choose_segment_language("ja", "ja", 3, ("en", 0.9), s) == "en"


def test_danh_sach_ngon_ngu_xen_doc_tu_bien_moi_truong(monkeypatch):
    monkeypatch.setenv("AI_WHISPER_LANGUAGES", "vi, en ,JA")
    assert Settings.from_env().languages == ("vi", "en", "ja")
    monkeypatch.delenv("AI_WHISPER_LANGUAGES")
    assert Settings.from_env().languages == ("vi", "en")


def test_chep_lai_bang_tieng_anh_ma_ra_chu_viet_thi_giu_tieng_viet():
    # Câu tiếng Việt xen thuật ngữ bị nhận là tiếng Anh; chép "bằng tiếng Anh" vẫn ra chữ có dấu.
    audio, spans = build_audio([(4, VI), (4, EN), (4, VI)])
    model = FakeModel(spans, len(audio))
    model.redo_text = "Và chốt task cho cái sprint tuần này"
    transcriber = WhisperTranscriber(Settings(), model=model)
    transcriber.diarize = False
    result = transcriber.transcribe_audio(audio, "vi")
    assert {s["language"] for s in result.segments} == {"vi"}
    # Giữ chữ của lượt đầu (tiếng Việt), không lấy bản chép lại.
    assert all("sprint" not in s["text"] for s in result.segments)


def test_chep_lai_chi_ra_vai_chu_cho_ca_doan_dai_la_cau_bia():
    audio, spans = build_audio([(4, VI), (18, EN), (4, VI)])
    model = FakeModel(spans, len(audio))
    model.redo_text = "How about the game?"
    transcriber = WhisperTranscriber(Settings(), model=model)
    transcriber.diarize = False
    result = transcriber.transcribe_audio(audio, "vi")
    assert {s["language"] for s in result.segments} == {"vi"}
    assert all("game" not in s["text"] for s in result.segments)


def test_plausible_switch():
    from app.worker.whisper_transcriber import plausible_switch

    w = lambda text: [(0.0, 1.0, " " + t) for t in text.split()]
    assert plausible_switch("en", "vi", w("we will ship the release on friday morning"), 3.0)
    assert not plausible_switch("en", "vi", w("Và chốt task cho cái sprint này"), 3.0)
    assert not plausible_switch("en", "vi", w("How about the game?"), 18.0)
    # Ngôn ngữ chính không phải tiếng Việt thì chữ có dấu không nói lên điều gì.
    assert plausible_switch("vi", "en", w("mình chốt việc này trong tuần nhé cả nhà"), 3.0)


def test_nguong_doi_ngon_ngu_mac_dinh():
    s = Settings()
    # Đoạn dưới 3 s không nhận lại ngôn ngữ; cần chắc từ 0,9.
    assert choose_segment_language("vi", "vi", 2.8, ("en", 0.99), s) == "vi"
    assert choose_segment_language("vi", "vi", 3.5, ("en", 0.85), s) == "vi"
    assert choose_segment_language("vi", "vi", 3.5, ("en", 0.93), s) == "en"


def test_nhan_ngon_ngu_chinh_tren_phan_co_tieng_noi():
    # 40 giây lặng rồi mới có người nói: Whisper phải nghe phần có tiếng, không phải 30 giây đầu.
    from app.worker.speech_regions import speech_probe

    rng = np.random.default_rng(0)
    silence = np.zeros(40 * SAMPLE_RATE, dtype=np.float32)
    speech = (0.2 * rng.standard_normal(20 * SAMPLE_RATE)).astype(np.float32)
    probe = speech_probe(np.concatenate([silence, speech]))
    assert 15 * SAMPLE_RATE <= len(probe) <= 21 * SAMPLE_RATE
    assert float(np.abs(probe).mean()) > 0.05
    # Dài hơn 30 giây tiếng nói thì chỉ lấy 30 giây.
    long = (0.2 * rng.standard_normal(90 * SAMPLE_RATE)).astype(np.float32)
    assert len(speech_probe(long)) == 30 * SAMPLE_RATE
    # Toàn lặng: trả nguyên bản ghi.
    assert speech_probe(silence) is silence


def test_ngon_ngu_chinh_luong_lu_thi_theo_cuoc_hop():
    s = Settings()
    assert choose_base_language("en", 0.7, "vi", s.base_min_prob) == "vi"
    assert choose_base_language("en", 0.95, "vi", s.base_min_prob) == "en"
