"""Quay các clip UI thật của MeetingMind cho video demo.

  python record_clips.py transcript minutes meetings bot drawer_swagger review_dry
  python record_clips.py hero --for-real     # DUYỆT THẬT 1 task (tạo thẻ Trello + tin Telegram)

Kết quả: public/clips/<tên>.mp4 (2560x1440, 30 fps) + <tên>.marks.json (mốc sự kiện).
"""
import asyncio, json, math, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rec_lib import CURSOR_JS, FE, Mouse, Recorder, login
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
CLIPS = os.path.join(ROOT, "public", "clips")
PROF = os.path.join(RAW, "chrome-profile")
W, H = 2560, 1440          # khung hình quay
CSS_W = 1536               # bố cục như màn 1536x864
MEETING_TRANSCRIPT = "6aeb5e8070b7f82afdbc47c8"
MEETING_HERO = "6aeb6762d975938cdf96ae87"
HERO_TITLE = "Hỏi khách về kênh gửi thông báo nhắc lịch"


def setup_profile():
    os.makedirs(os.path.join(PROF, "Default"), exist_ok=True)
    pref = os.path.join(PROF, "Default", "Preferences")
    data = {}
    if os.path.exists(pref):
        try:
            data = json.load(open(pref))
        except Exception:
            data = {}
    lvl = math.log(W / CSS_W) / math.log(1.2)
    data.setdefault("partition", {})["default_zoom_level"] = {"x": lvl}
    json.dump(data, open(pref, "w"))


async def goto(page, path, wait=2.0):
    await page.goto(FE + path, wait_until="networkidle")
    await asyncio.sleep(wait)


async def clip_transcript(page, m):
    await goto(page, f"/meetings/{MEETING_TRANSCRIPT}", 2.5)
    await m.move(900, 520, 0.01)
    r = Recorder(page, "transcript", RAW); await r.start()
    await asyncio.sleep(0.6)
    tab = page.get_by_role("tab", name="Transcript")
    await m.move_to(tab, 0.9)
    r.mark("click_tab"); await m.click()
    await asyncio.sleep(1.4)
    first = page.get_by_text("Người nói 1", exact=True).first
    await m.move_to(first, 0.9)
    r.mark("hover_speaker")
    await asyncio.sleep(0.8)
    await m.move(760, 560, 0.6)
    r.mark("scroll_start")
    await m.scroll(520, 3.2)
    await asyncio.sleep(0.6)
    sp5 = page.get_by_text("Người nói 5", exact=True).last
    await m.move_to(sp5, 1.0)
    r.mark("hover_sp5")
    await asyncio.sleep(1.2)
    await r.stop(); r.encode(f"{CLIPS}/transcript.mp4")


async def clip_minutes(page, m):
    await goto(page, f"/meetings/{MEETING_TRANSCRIPT}", 2.5)
    await m.move(1100, 560, 0.01)
    r = Recorder(page, "minutes", RAW); await r.start()
    await asyncio.sleep(0.5)
    tab = page.get_by_role("tab", name="Biên bản")
    await m.move_to(tab, 0.8, dx=0.3)
    r.mark("click_tab"); await m.click()
    await asyncio.sleep(1.6)
    ai = page.get_by_text("Tóm tắt").first
    await m.move_to(ai, 0.8)
    r.mark("hover_summary")
    await asyncio.sleep(0.8)
    await m.move(820, 560, 0.5)
    r.mark("scroll_start")
    await m.scroll(380, 2.6)
    await asyncio.sleep(0.4)
    dec = page.get_by_text("Quyết định").first
    await m.move_to(dec, 0.8)
    r.mark("hover_decisions")
    await asyncio.sleep(1.4)
    await r.stop(); r.encode(f"{CLIPS}/minutes.mp4")


async def clip_meetings(page, m):
    await goto(page, "/meetings", 2.5)
    await m.move(700, 300, 0.01)
    r = Recorder(page, "meetings", RAW); await r.start()
    await asyncio.sleep(0.5)
    # rê dọc cột "Hình thức": Ghi trực tiếp / Extension phụ đề / Bot Google Meet / Nhập bản ghi
    for label in ["Extension phụ đề", "Bot Google Meet", "Nhập bản ghi"]:
        loc = page.get_by_text(label, exact=True).filter(visible=True).first
        await m.move_to(loc, 0.75)
        r.mark("hover_" + label)
        await asyncio.sleep(0.7)
    await asyncio.sleep(0.4)
    await r.stop(); r.encode(f"{CLIPS}/meetings.mp4")


async def clip_bot(page, m):
    await goto(page, "/meetings", 2.5)
    await m.move(760, 520, 0.01)
    r = Recorder(page, "bot", RAW); await r.start()
    await asyncio.sleep(0.4)
    btn = page.get_by_text("Mời bot", exact=True).first
    await m.move_to(btn, 0.9)
    r.mark("click_bot"); await m.click()
    await asyncio.sleep(1.0)
    tab = page.get_by_role("dialog").get_by_text("Dán link", exact=True)
    await m.move_to(tab, 0.7)
    r.mark("click_paste"); await m.click()
    await asyncio.sleep(0.7)
    inp = page.get_by_placeholder("https://meet.google.com/abc-defg-hij")
    await m.move_to(inp, 0.6, dx=0.3)
    await m.click()
    r.mark("type_link")
    await page.keyboard.type("https://meet.google.com/kqp-mnvx-sjt", delay=45)
    await asyncio.sleep(0.3)
    name = page.get_by_placeholder("VD: Họp khách hàng")
    await m.move_to(name, 0.5, dx=0.3)
    await m.click()
    r.mark("type_name")
    await page.keyboard.type("Họp sprint 13", delay=60)
    await asyncio.sleep(0.3)
    ok = page.get_by_role("dialog").get_by_role("button", name="Mời bot vào ngay")
    await m.move_to(ok, 0.7)
    r.mark("hover_ok")   # KHÔNG bấm — chỉ minh hoạ
    await asyncio.sleep(1.2)
    await r.stop(); r.encode(f"{CLIPS}/bot.mp4")


async def open_drawer(page, m, title, name):
    await goto(page, "/work/board", 2.5)
    await m.move(1200, 640, 0.01)
    r = Recorder(page, name, RAW); await r.start()
    await asyncio.sleep(0.5)
    card = page.get_by_text(title, exact=True).first
    await m.move_to(card, 1.0)
    await asyncio.sleep(0.25)
    r.mark("click_card"); await m.click()
    await asyncio.sleep(1.3)
    chip = page.get_by_text("Trello", exact=False).filter(has_text="↗").first
    try:
        await m.move_to(chip, 0.9)
        r.mark("hover_trello")
    except Exception as e:
        print("no trello chip", e)
    await asyncio.sleep(0.8)
    tg = page.get_by_text("Đã báo Telegram", exact=True).first
    try:
        await m.move_to(tg, 0.6)
        r.mark("hover_telegram")
    except Exception as e:
        print("no telegram chip", e)
    await asyncio.sleep(1.6)
    await r.stop(); r.encode(f"{CLIPS}/{name}.mp4")


async def clip_drawer_swagger(page, m):
    await open_drawer(page, m, "Viết tài liệu API bằng Swagger", "drawer_swagger")


MARK_JS = r"""
([title, meetingId]) => {
  const res = [];
  const els = [...document.querySelectorAll('b, h3, h4, p, span, div')].filter(e => e.childElementCount === 0 && e.textContent.trim() === title);
  for (const el of els) {
    let e = el, link = null;
    while (e && e !== document.body) {
      const a = e.querySelector("a[href*='/meetings/']");
      if (a) { link = a.getAttribute('href'); break; }
      e = e.parentElement;
    }
    let card = el;
    while (card && card !== document.body && !([...card.querySelectorAll('button')].some(b => b.textContent.includes('Duyệt')))) card = card.parentElement;
    const btn = card ? [...card.querySelectorAll('button')].find(b => b.textContent.trim() === '✓ Duyệt') : null;
    const ok = !!(link && link.includes(meetingId));
    res.push({link, ok, hasBtn: !!btn, text: card ? card.innerText.slice(0, 60) : ''});
    if (ok && btn) {
      el.setAttribute('data-mm-hero', '1');
      btn.setAttribute('data-mm-approve', '1');
      const row = e;  // khối chứa link nguồn
      const q = [...row.querySelectorAll('*')].find(x => x.childElementCount === 0 && x.textContent.includes('Cái đó chị chưa hỏi khách'));
      if (q) q.setAttribute('data-mm-quote', '1');
    }
  }
  return res;
}
"""


async def find_hero_card(page):
    """Đánh dấu đúng đề xuất HERO_TITLE thuộc cuộc họp MEETING_HERO (có nút ✓ Duyệt)."""
    res = await page.evaluate(MARK_JS, [HERO_TITLE, MEETING_HERO])
    print("ứng viên:", res)
    hits = [r for r in res if r["ok"] and r["hasBtn"]]
    if len(hits) != 1:
        raise SystemExit(f"Cần đúng 1 mục chờ duyệt thuộc cuộc họp {MEETING_HERO}, thấy {len(hits)} — dừng")
    return page.locator("[data-mm-hero='1']")


async def clip_review(page, m, for_real):
    await goto(page, "/work/review", 3.0)
    title = await find_hero_card(page)
    await title.scroll_into_view_if_needed()
    await asyncio.sleep(0.5)
    await m.move(1000, 160, 0.01)
    name = "hero_review" if for_real else "review_dry"
    r = Recorder(page, name, RAW); await r.start()
    await asyncio.sleep(0.5)
    quote = page.locator("[data-mm-quote='1']")
    await m.move_to(quote, 1.0, dx=0.35)
    r.mark("hover_quote")
    await asyncio.sleep(1.0)
    await m.move_to(title, 0.8, dx=0.4)
    r.mark("hover_title")
    await asyncio.sleep(0.6)
    btn = page.locator("[data-mm-approve='1']")
    await m.move_to(btn, 0.8)
    await asyncio.sleep(0.35)
    r.mark("click_approve")
    if for_real:
        await m.click()
        try:
            await page.get_by_text("Đã duyệt · task vào cột Todo").first.wait_for(timeout=8000)
            r.mark("approved_ui")
        except Exception as e:
            print("không thấy thông báo đã duyệt:", e)
    else:
        await asyncio.sleep(0.12)
    await asyncio.sleep(2.4)
    await r.stop(); r.encode(f"{CLIPS}/{name}.mp4")


async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for_real = "--for-real" in sys.argv
    setup_profile()
    os.makedirs(CLIPS, exist_ok=True)
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            PROF, executable_path="/usr/bin/google-chrome", headless=True, no_viewport=True,
            locale="vi-VN", args=["--lang=vi-VN", "--hide-scrollbars", "--enable-gpu", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=gl-egl"])
        await ctx.add_init_script(CURSOR_JS)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.set_viewport_size({"width": W, "height": H})
        await ctx.clear_cookies()
        await page.goto(FE + "/login", wait_until="networkidle")
        await page.evaluate("localStorage.clear(); sessionStorage.clear()")
        await login(page)
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        who = await page.inner_text("body")
        print(who[:300].replace("\n", " | "))
        if "Administrator" not in who:
            raise SystemExit("Không đăng nhập được bằng admin")
        dpr = await page.evaluate("[innerWidth, innerHeight, devicePixelRatio]")
        print("viewport css/dpr", dpr)
        m = Mouse(page, 900, 500)
        for a in args:
            if a == "hero":
                await clip_review(page, m, for_real)
                if for_real:
                    print("chờ đồng bộ Trello/Telegram…")
                    await asyncio.sleep(7)
                    await open_drawer(page, m, HERO_TITLE, "hero_drawer")
            elif a == "review_dry":
                await clip_review(page, m, False)
            else:
                await globals()["clip_" + a](page, m)
        await ctx.close()

if __name__ == "__main__":
    asyncio.run(main())
