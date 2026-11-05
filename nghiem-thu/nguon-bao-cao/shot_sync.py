"""Chụp ngăn chi tiết công việc có dòng "Đồng bộ" (Trello ↗, Đã báo Telegram)."""

import os
import time

from playwright.sync_api import sync_playwright

FE = "http://localhost:3001"
FIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    page = browser.new_context(viewport={"width": 1440, "height": 860}, device_scale_factor=1.5).new_page()
    page.goto(FE + "/login", wait_until="networkidle")
    page.fill("input[autocomplete=username]", "admin")
    page.fill("input[type=password]", "admin")
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard**", timeout=60000)
    page.goto(FE + "/work/board", wait_until="networkidle")
    time.sleep(3)
    page.get_by_text("Viết tài liệu API bằng Swagger").first.click()
    page.get_by_text("Đồng bộ", exact=True).wait_for(timeout=15000)
    time.sleep(1.5)
    page.screenshot(path=os.path.join(FIG, "fig-ui-sync.png"))
    print("chụp fig-ui-sync")
    browser.close()
