"""Thư viện quay màn hình UI thật bằng CDP screencast (chất lượng cao hơn video mặc định của Playwright).

- Khung hình JPEG kèm timestamp -> ghép thành MP4 CFR 30 fps bằng ffmpeg.
- Chèn con trỏ chuột giả (headless không có con trỏ) + hiệu ứng gợn khi click.
- Di chuột/cuộn mượt có easing.
"""
import asyncio, base64, math, os, shutil, subprocess

FE = "http://localhost:3001"

CURSOR_JS = r"""
(() => {
  const install = () => {
    if (document.getElementById('__mm_cursor')) return;
    const c = document.createElement('div');
    c.id = '__mm_cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.4 L14.4 20.2 L11.4 13.7 L17.6 13.7 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {position:'fixed', left:'0px', top:'0px', width:'26px', height:'26px', zIndex: 2147483647, pointerEvents:'none', transform:'translate(-5px,-3px)', transition:'transform 90ms ease'});
    let pos = {x: -100, y: -100};
    try { const s = sessionStorage.getItem('__mm_pos'); if (s) pos = JSON.parse(s); } catch (e) {}
    c.style.left = pos.x + 'px'; c.style.top = pos.y + 'px';
    document.documentElement.appendChild(c);
    document.addEventListener('mousemove', e => {
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
      try { sessionStorage.setItem('__mm_pos', JSON.stringify({x: e.clientX, y: e.clientY})); } catch (err) {}
    }, true);
    document.addEventListener('mousedown', e => {
      c.style.transform = 'translate(-5px,-3px) scale(0.82)';
      const r = document.createElement('div');
      Object.assign(r.style, {position:'fixed', left:(e.clientX-22)+'px', top:(e.clientY-22)+'px', width:'44px', height:'44px', borderRadius:'50%', border:'3px solid rgba(76,124,235,.9)', background:'rgba(76,124,235,.18)', zIndex:2147483646, pointerEvents:'none', transform:'scale(.3)', opacity:'1', transition:'transform 450ms cubic-bezier(.2,.8,.2,1), opacity 450ms ease'});
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scale(1.6)'; r.style.opacity = '0'; }));
      setTimeout(() => r.remove(), 600);
    }, true);
    document.addEventListener('mouseup', () => { c.style.transform = 'translate(-5px,-3px)'; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  // Ẩn overlay dev của Next.js
  const hide = () => { document.querySelectorAll('nextjs-portal').forEach(n => n.style.display = 'none'); };
  setInterval(hide, 300);
})();
"""


class Recorder:
    def __init__(self, page, name, raw_dir, quality=92, max_w=3200, max_h=1800):
        self.max_w, self.max_h = max_w, max_h
        self.page = page
        self.name = name
        self.dir = os.path.join(raw_dir, name)
        shutil.rmtree(self.dir, ignore_errors=True)
        os.makedirs(self.dir)
        self.frames = []
        self.quality = quality
        self.cdp = None
        self.marks = []
        self.t0 = None

    async def start(self):
        self.cdp = await self.page.context.new_cdp_session(self.page)
        self.cdp.on("Page.screencastFrame", self._on_frame)
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": self.quality, "everyNthFrame": 1, "maxWidth": self.max_w, "maxHeight": self.max_h})

    def _on_frame(self, params):
        ts = params["metadata"]["timestamp"]
        path = os.path.join(self.dir, f"f{len(self.frames):05d}.jpg")
        with open(path, "wb") as f:
            f.write(base64.b64decode(params["data"]))
        self.frames.append((ts, path))
        if self.t0 is None:
            self.t0 = ts
        asyncio.ensure_future(self.cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]}))

    def mark(self, label):
        import time
        self.marks.append((label, time.time()))
        print(f"  mark {label}")

    async def stop(self):
        import time
        self.t_stop = time.time()
        await asyncio.sleep(0.3)
        await self.cdp.send("Page.stopScreencast")
        await asyncio.sleep(0.2)

    def encode(self, out_mp4, fps=30, tail=0.5):
        frames = sorted(self.frames)
        if not frames:
            raise RuntimeError("no frames")
        lst = os.path.join(self.dir, "list.txt")
        with open(lst, "w") as f:
            for i, (ts, path) in enumerate(frames):
                nxt = frames[i + 1][0] if i + 1 < len(frames) else max(ts + 0.05, getattr(self, "t_stop", ts + tail))
                f.write(f"file '{path}'\nduration {max(nxt - ts, 0.001):.4f}\n")
            f.write(f"file '{frames[-1][1]}'\n")
        dur = max(frames[-1][0] + 0.05, getattr(self, "t_stop", frames[-1][0] + tail)) - frames[0][0]
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-vf", f"fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart", out_mp4], check=True)
        # mốc thời gian (giây tính từ khung đầu) -> json cạnh file mp4
        import json
        marks = {label: round(t - frames[0][0], 3) for label, t in self.marks}
        with open(out_mp4.rsplit(".", 1)[0] + ".marks.json", "w") as f:
            json.dump({"duration": round(dur, 3), "marks": marks}, f, ensure_ascii=False, indent=1)
        print(f"[{self.name}] {len(frames)} frames, {dur:.2f}s, ~{len(frames)/dur:.1f} fps -> {out_mp4}")
        return dur


def ease(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


class Mouse:
    def __init__(self, page, x=800, y=450):
        self.page = page
        self.x, self.y = x, y

    async def move(self, x, y, dur=0.8, curve=0.12):
        steps = max(2, int(dur * 60))
        x0, y0 = self.x, self.y
        # control point lệch ngang -> đường cong tự nhiên
        dx, dy = x - x0, y - y0
        cx, cy = x0 + dx * 0.5 - dy * curve, y0 + dy * 0.5 + dx * curve
        for i in range(1, steps + 1):
            t = ease(i / steps)
            px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x
            py = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y
            await self.page.mouse.move(px, py)
            await asyncio.sleep(dur / steps)
        self.x, self.y = x, y

    async def move_to(self, locator, dur=0.8, dx=0.5, dy=0.5):
        box = await locator.bounding_box(timeout=6000)
        await self.move(box["x"] + box["width"] * dx, box["y"] + box["height"] * dy, dur)

    async def click(self, hold=0.12):
        await self.page.mouse.down()
        await asyncio.sleep(hold)
        await self.page.mouse.up()

    async def scroll(self, total, dur=1.5):
        steps = max(2, int(dur * 60))
        done = 0
        for i in range(1, steps + 1):
            target = total * ease(i / steps)
            d = target - done
            await self.page.mouse.wheel(0, d)
            done = target
            await asyncio.sleep(dur / steps)


async def login(page):
    await page.goto(FE + "/login", wait_until="networkidle")
    await page.fill("input[autocomplete=username]", "admin")
    await page.fill("input[type=password]", "admin")
    await page.click("button[type=submit]")
    await page.wait_for_url("**/dashboard**", timeout=60000)
