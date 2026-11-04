"""Master âm thanh của bản render Remotion: đưa về ~-14 LUFS, true peak < -1 dBTP, giữ nguyên hình (copy).

  python scripts/master.py out/render_raw.mp4 out/MeetingMind_Demo.mp4
"""
import json
import re
import subprocess
import sys

TARGET_I = -14.0
LIMIT = 10 ** (-2.0 / 20)  # trần mẫu -2 dBFS -> true peak thường < -1 dBTP


def measure(path, af=None):
    chain = (af + "," if af else "") + "ebur128=peak=true"
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", chain, "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summary = out[out.rfind("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    lra = float(re.search(r"LRA:\s+(-?[\d.]+) LU", summary).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return {"I": I, "LRA": lra, "TP": tp}


def chain(gain_db):
    return f"volume={gain_db:.2f}dB,alimiter=limit={LIMIT:.4f}:attack=3:release=60:level=disabled,aresample=48000"


def main(src, dst):
    m0 = measure(src)
    print("raw   ", m0)
    gain = TARGET_I - m0["I"]
    for _ in range(3):
        m = measure(src, chain(gain))
        print(f"gain {gain:+.2f} dB ->", m)
        if abs(m["I"] - TARGET_I) < 0.25 and m["TP"] < -1.0:
            break
        gain += TARGET_I - m["I"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-c:v", "copy", "-af", chain(gain),
                    "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", dst], check=True)
    final = measure(dst)
    print("final ", final)
    json.dump({"raw": m0, "gain_db": round(gain, 2), "final": final}, open(dst.rsplit(".", 1)[0] + ".loudness.json", "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
