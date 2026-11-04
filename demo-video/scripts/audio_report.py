"""Báo cáo nhanh độ lớn theo thời gian (short-term LUFS mỗi 0,5 s) của file video/âm thanh.

  python scripts/audio_report.py out/MeetingMind_Demo.mp4
"""
import re, subprocess, sys
path = sys.argv[1]
out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true:framelog=info", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
rows = re.findall(r"t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)", out)
last = -1
line = []
for t, M, S in rows:
    t = float(t)
    if int(t * 2) != last:
        last = int(t * 2)
        if last % 2 == 0:
            line.append(f"{t:5.1f}:{float(S) if S != '-inf' else -99:6.1f}")
for i in range(0, len(line), 8):
    print("  ".join(line[i:i + 8]))
summary = out[out.rfind("Summary:"):]
print(summary)
