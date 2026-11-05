"""Render các sơ đồ HTML trong thư mục này ra PNG (figures/<nhãn>.png).

Chạy: venv/bin/python render.py [nhãn ...]   (không có nhãn = tất cả)
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

SRC = Path(__file__).resolve().parent
OUT = SRC.parent


def main(names: list[str]) -> None:
    files = [SRC / f"{n}.html" for n in names] if names else sorted(SRC.glob("fig-*.html"))
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = browser.new_context(viewport={"width": 1700, "height": 1300}, device_scale_factor=2)
        page = ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        for f in files:
            errors.clear()
            page.goto(f.as_uri())
            page.wait_for_function("window.__ready === true", timeout=10000)
            fig = page.locator("#fig")
            out = OUT / f"{f.stem}.png"
            fig.screenshot(path=str(out))
            box = fig.bounding_box()
            print(f"{f.stem}: {int(box['width'] * 2)}x{int(box['height'] * 2)} px", "LỖI: " + "; ".join(errors) if errors else "")
        browser.close()


if __name__ == "__main__":
    main(sys.argv[1:])
