"""Dựng bộ audio thực nghiệm từ FPT TTS: mỗi người nói một giọng, có mốc chuẩn.

Chạy trong container ai-worker (có numpy, requests, key ở AI_LLM_API_KEY):
  python /check/eval/build_dataset.py
Ra: /check/eval/data/<variant>.wav (16 kHz mono) + <variant>.json (mốc chuẩn).
"""

import io
import json
import os
import wave

import numpy as np
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")
CACHE = os.path.join(HERE, "tts_cache")
SR = 16000
KEY = os.environ["AI_LLM_API_KEY"]

VOICES = {"Lan": "banmai", "Nam": "leminh", "Hùng": "giahuy", "Phương": "ngoclam"}

# Kịch bản họp sprint (giống bài chấm LLM), câu tiếng Anh chuyển sang tiếng Việt
# vì TTS chỉ có giọng Việt.
SCRIPT = [
    ("Lan", "Ok mọi người, hôm nay mình chốt phạm vi sprint mười hai cho ứng dụng đặt lịch phòng khám nhé. Có ba việc chính: đăng nhập, thanh toán, và thông báo nhắc lịch."),
    ("Nam", "Phần đăng nhập em làm xong API đăng ký rồi, còn đăng nhập bằng số điện thoại với mã OTP."),
    ("Hùng", "Hay là mình dùng luôn Firebase cho OTP, đỡ phải tự làm?"),
    ("Lan", "Firebase thì tiền tin nhắn ở Việt Nam hơi cao, để Nam tìm hiểu thêm giá rồi tính."),
    ("Nam", "Vâng, em so sánh Firebase với eSMS rồi báo lại chị trước thứ Tư."),
    ("Phương", "Về cơ sở dữ liệu thì team mình thống nhất PostgreSQL chứ? Em thấy MongoDB hơi khó làm báo cáo."),
    ("Lan", "Ừ, chốt PostgreSQL nhé, không bàn lại nữa."),
    ("Hùng", "Ok, PostgreSQL."),
    ("Lan", "Thanh toán thì sao Hùng?"),
    ("Hùng", "Em đang tích hợp VNPay bản thử nghiệm. Chắc ngày mười lăm tháng mười một xong bản đầu. À không, ngày mười tám đi chị, vì hôm mười lăm em phải đi bảo vệ đồ án."),
    ("Lan", "Ok ngày mười tám tháng mười một nhé. Nhớ viết kiểm thử cho phần callback."),
    ("Phương", "Có cần hỗ trợ ví MoMo luôn không chị?"),
    ("Lan", "MoMo chưa, khách chưa yêu cầu. Để sprint sau tính."),
    ("Nam", "Còn phần thông báo nhắc lịch thì ai làm ạ?"),
    ("Lan", "Ban đầu chị định giao Nam, nhưng Nam đang ôm phần đăng nhập rồi. Thôi để Hùng làm phần nhắc lịch sau khi xong thanh toán."),
    ("Hùng", "Dạ được, nhưng em cần biết gửi qua Zalo hay tin nhắn SMS."),
    ("Lan", "Cái đó chị chưa hỏi khách. Chị sẽ hỏi bên phòng khám rồi báo lại."),
    ("Nam", "Nhân tiện, bên thiết kế báo giao diện mới sẽ xong vào thứ Hai tới."),
    ("Lan", "Tốt, vậy chiều thứ Ba cả nhóm cùng xem lại giao diện nhé."),
    ("Hùng", "Hôm qua mọi người xem bóng đá không, Việt Nam thắng hai không đấy."),
    ("Nam", "Có, đá hay quá, chắc phải đi ăn mừng."),
    ("Lan", "Thôi quay lại việc. Một vấn đề nữa là ngân sách máy chủ. Hiện đang dùng gói hai triệu một tháng, chắc không đủ khi có thanh toán."),
    ("Phương", "Em nghĩ phải lên gói năm triệu, nhưng cần sếp duyệt."),
    ("Lan", "Ừ, cái này chưa quyết được, để chị trình anh Tuấn."),
    ("Nam", "Em có thể tối ưu lại câu truy vấn trước, biết đâu không cần nâng gói."),
    ("Lan", "Tốt, Nam thử xem, nhưng ưu tiên OTP trước."),
    ("Phương", "Em viết tài liệu API bằng Swagger cho cả team nhé, cuối tuần này em gửi."),
    ("Lan", "Ok cảm ơn em. Vậy tổng kết: Nam lo OTP, Hùng lo thanh toán rồi nhắc lịch, Phương lo tài liệu API."),
    ("Phương", "Dạ."),
    ("Lan", "Cuộc họp sau vào thứ Hai tuần sau, chín giờ sáng. Hết."),
]

# Tiếng nói chuyện nền cho điều kiện "phòng đông người".
BABBLE = [
    ("kimngan", "Chiều nay bên kế toán gửi lại bảng lương tháng này, mọi người kiểm tra giúp nhé."),
    ("huyphong", "Máy in tầng ba lại hết mực rồi, ai gọi kỹ thuật lên xem với."),
    ("minhquan", "Trưa nay đi ăn bún chả hay cơm văn phòng, chốt sớm để còn đặt bàn."),
    ("kimngan", "Phòng họp lớn đã có người đặt từ hai giờ đến bốn giờ chiều."),
    ("huyphong", "Bạn nào cầm chìa khoá tủ hồ sơ thì để lại lễ tân giúp mình."),
    ("minhquan", "Tuần sau công ty tổ chức đi dã ngoại, nhớ đăng ký trước thứ Sáu."),
]


def tts(voice: str, text: str) -> np.ndarray:
    os.makedirs(CACHE, exist_ok=True)
    name = os.path.join(CACHE, f"{voice}_{abs(hash(text)) % 10**12}.wav")
    if not os.path.exists(name):
        r = requests.post(
            "https://token-api.fpt.ai/v1/audio/speech",
            headers={"Authorization": f"Bearer {KEY}"},
            json={"model": "FPT.AI-VITs", "input": text, "voice": voice, "speed": 1},
            timeout=120,
        )
        r.raise_for_status()
        open(name, "wb").write(r.content)
    with wave.open(name) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    # Đổi tần số lấy mẫu về 16 kHz bằng nội suy tuyến tính (đủ cho tiếng nói).
    n = int(len(x) * SR / sr)
    y = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)
    # Cắt bớt khoảng lặng đầu/cuối do TTS chèn để mốc chuẩn sát lời nói.
    idx = np.where(np.abs(y) > 0.01)[0]
    if len(idx):
        y = y[max(0, idx[0] - 800) : idx[-1] + 800]
    return y / max(1e-6, np.abs(y).max()) * 0.6


def save(name: str, audio: np.ndarray, segments: list, extra: dict | None = None) -> None:
    os.makedirs(OUT, exist_ok=True)
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    meta = {"name": name, "duration_s": round(len(audio) / SR, 2), "segments": segments, **(extra or {})}
    json.dump(meta, open(os.path.join(OUT, name + ".json"), "w"), ensure_ascii=False, indent=1)
    print(f"{name}: {meta['duration_s']}s, {len(segments)} đoạn")


def compose(clips, rng, overlap_at=(), silence_after=None, silence_s=0.0):
    """Ghép các câu với khoảng nghỉ ngẫu nhiên; overlap_at: các câu bắt đầu đè lên câu trước."""
    total = int(sum(len(c) for c in clips) + SR * (1.0 * len(clips) + silence_s + 2))
    audio = np.zeros(total, dtype=np.float32)
    segments, overlaps, silence = [], [], None
    t = int(0.5 * SR)
    for i, clip in enumerate(clips):
        start = t
        if i in overlap_at and segments:
            prev_end = int(segments[-1]["end"] * SR)
            start = prev_end - int(1.2 * SR)
            overlaps.append([round(start / SR, 3), round(prev_end / SR, 3)])
        audio[start : start + len(clip)] += clip
        end = start + len(clip)
        segments.append({"index": i, "start": round(start / SR, 3), "end": round(end / SR, 3)})
        t = max(t, end) + int(rng.uniform(0.3, 0.9) * SR)
        if silence_after is not None and i == silence_after:
            silence = [round(t / SR, 3), round((t + silence_s * SR) / SR, 3)]
            t += int(silence_s * SR)
    return audio[: t + int(0.5 * SR)], segments, overlaps, silence


def add_noise(audio, noise, snr_db):
    sp = np.mean(audio[np.abs(audio) > 0.01] ** 2)
    noise = noise[: len(audio)]
    npow = np.mean(noise**2)
    return audio + noise * np.sqrt(sp / (npow * 10 ** (snr_db / 10)))


def main():
    rng = np.random.default_rng(7)
    clips = [tts(VOICES[s], t) for s, t in SCRIPT]

    def with_text(segs):
        for seg in segs:
            speaker, text = SCRIPT[seg["index"]]
            seg.update(speaker=speaker, text=text)
        return segs

    clean, segs, _, _ = compose(clips, np.random.default_rng(7))
    segs = with_text(segs)
    save("clean", clean, segs)

    white = rng.normal(0, 1, len(clean)).astype(np.float32)
    for snr in (20, 10, 5):
        save(f"white_snr{snr}", add_noise(clean, white, snr), segs, {"snr_db": snr, "noise": "white"})

    # Nhiễu đông người: nhiều giọng khác nói chồng lên nhau, lặp cho đủ dài.
    bab = np.zeros(len(clean), dtype=np.float32)
    talkers = [tts(v, t) for v, t in BABBLE]
    for k, clip in enumerate(talkers):
        pos = int(k * 0.37 * SR)
        while pos < len(bab):
            n = min(len(clip), len(bab) - pos)
            bab[pos : pos + n] += clip[:n]
            pos += len(clip) + int(rng.uniform(0.2, 1.0) * SR)
    save("babble_snr10", add_noise(clean, bab, 10), segs, {"snr_db": 10, "noise": "babble"})

    # Nói chồng: 4 chỗ câu sau chen vào 1,2 giây cuối câu trước; thêm 8 giây chỉ có nhiễu nền.
    ov, osegs, overlaps, silence = compose(
        clips, np.random.default_rng(7), overlap_at=(3, 9, 15, 24), silence_after=19, silence_s=8.0
    )
    osegs = with_text(osegs)
    hum = rng.normal(0, 1, len(ov)).astype(np.float32)
    save("overlap", add_noise(ov, hum, 25), osegs, {"overlaps": overlaps, "noise_only": silence})


if __name__ == "__main__":
    main()
