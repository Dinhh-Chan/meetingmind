"""So độ lớn lời thoại với nền (nhạc + SFX) theo từng câu, từ 2 stem out/stem_vo.wav và out/stem_bg.wav."""
import re, subprocess, os, sys
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def mom(path):
    out = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",path,"-af","ebur128=framelog=info","-f","null","-"],capture_output=True,text=True).stderr
    rows = re.findall(r"t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)", out)
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", out[out.rfind("Summary"):])[0]
    return {round(float(t),1): (float(m) if m!='-inf' else -120) for t,m in rows}, I
vo, Ivo = mom(os.path.join(ROOT, "out/stem_vo.wav")); bg, Ibg = mom(os.path.join(ROOT, "out/stem_bg.wav"))
print("I vo", Ivo, "I bg", Ibg)
src = open(os.path.join(ROOT, "src/timeline.ts")).read()
import json
dur = json.load(open(os.path.join(ROOT, "src/vo-durations.json")))
for lid, f in re.findall(r'\{ id: "(vo[^"]+)", from: (\d+) \}', src):
    a = int(f) / 30; d = dur[lid]
    ts = [t for t in vo if a + 0.3 <= t <= a + d and vo[t] > -35]
    if not ts: continue
    diffs = sorted(vo[t] - bg.get(t, -120) for t in ts)
    print(f"{lid:16s} @{a:5.1f}s  VO-BG median {diffs[len(diffs)//2]:5.1f} LU  p10 {diffs[len(diffs)//10]:5.1f} LU")
