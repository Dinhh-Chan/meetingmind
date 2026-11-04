"""Cắt lặng đầu/cuối, nén nhẹ, chuẩn hoá -16 LUFS cho các file lời thoại: raw/vo -> public/vo/*.flac (48 kHz mono).

Câu "vo02_problem" (4 cụm: Ghi chép tay. / Sót việc. / Giao nhầm người. / Trễ hạn.) được tự tách tại
3 khoảng lặng dài nhất thành vo02a..d để đặt từng cụm đúng nhịp chữ đập.
Chạy xong nhớ chạy scripts/vo_durations.py để cập nhật src/vo-durations.json.
"""
import json, os, re, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.load(open(os.path.join(ROOT, "scripts", "vo_lines.json"), encoding="utf-8"))
os.makedirs(os.path.join(ROOT, "public", "vo"), exist_ok=True)
CHAIN = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,"
         "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,"
         "highpass=f=80,equalizer=f=3500:t=q:w=1.2:g=2,acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3")
def split_problem(path):
    """Tách thành 4 cụm lời (gộp các đoạn có tiếng gần nhau nhất, bỏ tiếng lách tách ngắn) -> vo02a..d."""
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout)
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=n=-40dB:d=0.12", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    # các đoạn có tiếng = phần bù của khoảng lặng
    edges = [0.0]
    for a, b in zip(starts, ends):
        edges += [a, b]
    edges.append(dur)
    voiced = [(edges[i], edges[i + 1]) for i in range(0, len(edges) - 1, 2) if edges[i + 1] - edges[i] >= 0.1]
    while voiced and voiced[-1][1] - voiced[-1][0] < 0.25:  # tiếng thở/lách tách ở cuối
        voiced.pop()
    while len(voiced) > 4:
        gaps = [voiced[i + 1][0] - voiced[i][1] for i in range(len(voiced) - 1)]
        i = gaps.index(min(gaps))
        voiced[i:i + 2] = [(voiced[i][0], voiced[i + 1][1])]
    if len(voiced) != 4:
        raise SystemExit(f"không tách được 4 cụm: {voiced}")
    for (a, b), name in zip(voiced, "abcd"):
        seg = os.path.join(ROOT, "public", "vo", f"vo02{name}_problem.flac")
        af = f"atrim=start={max(0, a - 0.03):.3f}:end={min(dur, b + 0.05):.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,areverse,afade=t=in:d=0.03,areverse"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-af", af, "-c:a", "flac", seg], check=True)
    os.remove(path)
    print("  tách vo02_problem:", [(round(a, 2), round(b, 2)) for a, b in voiced])


def main():
    for lid in lines:
        src = os.path.join(ROOT, "raw", "vo", lid + ".wav")
        tmp = os.path.join(ROOT, "raw", "vo", lid + ".proc.wav")
        dst = os.path.join(ROOT, "public", "vo", lid + ".flac")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", CHAIN, "-ar", "48000", "-ac", "2", tmp], check=True)
        out = subprocess.run(["ffmpeg", "-hide_banner", "-i", tmp, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
        I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])
        gain = -16.0 - I
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.79:attack=2:release=40:level=disabled",
                        "-ar", "48000", "-ac", "1", "-c:a", "flac", dst], check=True)
        os.remove(tmp)
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst], capture_output=True, text=True).stdout)
        print(f"{lid}: {dur:.2f}s  (gain {gain:+.1f} dB)")
        if lid == "vo02_problem":
            split_problem(dst)


if __name__ == "__main__":
    main()
