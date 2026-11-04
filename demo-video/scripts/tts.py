"""Sinh lời thoại tiếng Việt bằng FPT AI TTS (FPT.AI-VITs).

  python tts.py            # sinh tất cả dòng trong LINES -> raw/vo/<id>.wav
  python tts.py test "câu thử" leminh

Khoá lấy từ biến FPT_AI_API_KEY trong ../../.env (không in ra).
"""
import json, os, sys
import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(os.path.dirname(ROOT), ".env")
OUT = os.path.join(ROOT, "raw", "vo")


def key():
    if os.environ.get("FPT_AI_API_KEY"):
        return os.environ["FPT_AI_API_KEY"]
    for line in open(ENV, encoding="utf-8"):
        line = line.strip()
        if line.startswith("FPT_AI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("thiếu FPT_AI_API_KEY")


def speak(text, voice, path, speed=1):
    r = requests.post("https://token-api.fpt.ai/v1/audio/speech",
                      headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"},
                      json={"model": "FPT.AI-VITs", "input": text, "voice": voice, "speed": speed}, timeout=120)
    if r.status_code != 200:
        raise SystemExit(f"TTS lỗi {r.status_code}: {r.text[:300]}")
    with open(path, "wb") as f:
        f.write(r.content)
    print("ok", os.path.basename(path), len(r.content), r.headers.get("content-type"))


VOICE = "leminh"
LINES = json.load(open(os.path.join(ROOT, "scripts", "vo_lines.json"), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, "scripts", "vo_lines.json")) else {}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        text, voice = sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else VOICE
        name = sys.argv[4] if len(sys.argv) > 4 else "test_" + voice
        speak(text, voice, os.path.join(OUT, name + ".wav"))
    else:
        only = set(sys.argv[1:])
        for lid, item in LINES.items():
            if only and lid not in only:
                continue
            speak(item["text"], item.get("voice", VOICE), os.path.join(OUT, lid + ".wav"), item.get("speed", 1))
