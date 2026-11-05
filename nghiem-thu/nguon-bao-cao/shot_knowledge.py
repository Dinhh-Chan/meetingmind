"""Chụp trang Tri thức: danh sách hội thoại, notebook nguồn và một câu trả lời có trích dẫn."""

import os
import time

from playwright.sync_api import sync_playwright

FE = "http://localhost:3001"
FIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    page = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5).new_page()
    page.goto(FE + "/login", wait_until="networkidle")
    page.fill("input[autocomplete=username]", "admin")
    page.fill("input[type=password]", "admin")
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard**", timeout=90000)
    page.goto(FE + "/knowledge", wait_until="networkidle")
    time.sleep(4)
    # Bắt đầu cuộc trò chuyện mới để ảnh gọn, rồi hỏi một câu có nhiều nguồn.
    new = page.get_by_role("button", name="Cuộc trò chuyện mới")
    if new.count():
        new.first.click()
        time.sleep(1)
    page.fill("input[aria-label='Câu hỏi']", "Chiến dịch Tết chạy kênh nào, ai viết bài đăng và hạn khi nào?")
    page.get_by_role("button", name="Hỏi", exact=True).click()
    page.wait_for_selector("text=[1]", timeout=90000)
    time.sleep(3)
    page.screenshot(path=os.path.join(FIG, "fig-ui-knowledge.png"))
    print("chụp fig-ui-knowledge")
    browser.close()
