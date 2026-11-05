"""Chụp màn hình giao diện MeetingMind (dữ liệu thật trên môi trường local).

  python screenshots.py <meetingId>
"""

import os
import sys
import time

from playwright.sync_api import sync_playwright

FE = "http://localhost:3001"
FIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures")
meeting_id = sys.argv[1]


def shot(page, name, wait=2.5):
    time.sleep(wait)
    page.screenshot(path=os.path.join(FIG, name + ".png"))
    print("chụp", name)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--lang=vi-VN"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 860}, device_scale_factor=1.5, locale="vi-VN")
    page = ctx.new_page()
    page.goto(FE + "/login", wait_until="networkidle")
    page.fill("input[autocomplete=username]", "admin")
    page.fill("input[type=password]", "admin")
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard**", timeout=60000)

    page.goto(FE + "/dashboard", wait_until="networkidle")
    shot(page, "fig-ui-dashboard", 4)

    page.goto(FE + "/meetings", wait_until="networkidle")
    shot(page, "fig-ui-meetings", 3)

    page.goto(f"{FE}/meetings/{meeting_id}", wait_until="networkidle")
    time.sleep(3)
    page.get_by_role("tab", name="Transcript").click()
    shot(page, "fig-ui-transcript", 3)
    page.get_by_role("tab", name="Biên bản").click()
    shot(page, "fig-ui-minutes", 3)

    page.goto(FE + "/work/review", wait_until="networkidle")
    shot(page, "fig-ui-review", 4)

    page.goto(FE + "/work/board", wait_until="networkidle")
    shot(page, "fig-ui-board", 4)

    page.goto(FE + "/meetings", wait_until="networkidle")
    time.sleep(2)
    page.get_by_text("Mời bot", exact=True).first.click()
    shot(page, "fig-ui-bot", 2)
    browser.close()
