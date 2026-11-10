"""Whisper chạy CPU khi GPU không dùng được.

QA (ghi âm nhanh): máy GPU báo "no CUDA-capable device is detected" làm hỏng
cả bản ghi. Chậm hơn còn hơn mất transcript.
"""

import asyncio
import sys
import types

import pytest

from app.worker import whisper_transcriber as wt

CUDA_ERROR = "CUDA failed with error no CUDA-capable device is detected"


class FakeWhisper:
    created: list[str] = []

    def __init__(self, model, device, compute_type):
        FakeWhisper.created.append(device)
        if device == "cuda":
            raise RuntimeError(CUDA_ERROR)
        self.device = device


@pytest.fixture(autouse=True)
def fake_faster_whisper(monkeypatch):
    FakeWhisper.created = []
    module = types.SimpleNamespace(WhisperModel=FakeWhisper, decode_audio=lambda path, rate: "audio")
    monkeypatch.setitem(sys.modules, "faster_whisper", module)
    monkeypatch.setattr(wt, "_model", None)


def test_nap_model_tren_cpu_khi_khong_thay_gpu():
    model = wt._load_model(wt.Settings(device="cuda", compute_type="float16"))
    assert model.device == "cpu"
    assert FakeWhisper.created == ["cuda", "cpu"]


def test_loi_khac_khong_bi_nuot(monkeypatch):
    def broken(model, device, compute_type):
        raise RuntimeError("Unable to open file 'model.bin'")

    monkeypatch.setattr(sys.modules["faster_whisper"], "WhisperModel", broken)
    with pytest.raises(RuntimeError, match="model.bin"):
        wt._load_model(wt.Settings(device="cuda"))


def test_gpu_mat_giua_chung_thi_chay_lai_tren_cpu(monkeypatch, tmp_path):
    file = tmp_path / "rec.wav"
    file.write_bytes(b"x")
    monkeypatch.setattr(wt, "download_to_temp", lambda bucket, key: file)

    calls = []

    def transcribe_audio(self, audio, hint, voice_profiles=None):
        calls.append(getattr(self._model, "device", "gpu"))
        if len(calls) == 1:
            raise RuntimeError(CUDA_ERROR)
        return "transcript"

    monkeypatch.setattr(wt.WhisperTranscriber, "transcribe_audio", transcribe_audio)
    transcriber = wt.WhisperTranscriber(wt.Settings(device="cuda"), model=object(), diarizer=object())
    result = asyncio.run(transcriber.transcribe("bucket", "key", "vi"))
    assert result == "transcript"
    assert calls == ["gpu", "cpu"]
