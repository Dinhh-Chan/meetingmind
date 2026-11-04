"""Ghi độ dài các file public/vo/*.flac vào src/vo-durations.json (timeline đọc file này)."""
import glob, json, os, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
for f in sorted(glob.glob(os.path.join(ROOT, "public", "vo", "*.flac"))):
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)
    out[os.path.basename(f).rsplit('.', 1)[0]] = round(d, 3)
json.dump(out, open(os.path.join(ROOT, "src", "vo-durations.json"), "w"), indent=1)
print(out, "tổng", round(sum(out.values()), 2))
