#!/bin/sh
# Đăng nhập tài khoản Google của bot một lần.
#
# Mở Chromium của bot trên màn hình ảo, xem và điều khiển qua noVNC tại
# http://localhost:6080/vnc.html. Người dùng tự đăng nhập; hồ sơ (cookie đăng
# nhập) lưu ở /profile — volume bot-profile — để bot dùng lại khi vào Meet.
#
# Chạy Chromium như trình duyệt bình thường, không qua Playwright: trang đăng
# nhập Google không làm việc với trình duyệt đang bị điều khiển tự động.
set -e
PROFILE=${BOT_PROFILE_DIR:-/profile}
CHROME=$(ls /ms-playwright/chromium-*/chrome-linux*/chrome | head -n1)

Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 &
export DISPLAY=:99
for i in $(seq 1 50); do [ -e /tmp/.X11-unix/X99 ] && break; sleep 0.1; done

# VNC chỉ nghe trong container; cổng noVNC được map ra 127.0.0.1 của máy chủ.
x11vnc -display :99 -forever -shared -nopw -localhost -quiet >/dev/null 2>&1 &
websockify --web /usr/share/novnc 6080 localhost:5900 >/dev/null 2>&1 &

echo "Mở http://localhost:6080/vnc.html để đăng nhập tài khoản Google của bot."
echo "Đăng nhập xong thì đóng cửa sổ Chromium (hoặc dừng container)."
# --disable-sync: tài khoản bot không kéo extension/tab/lịch sử đồng bộ về hồ sơ.
exec "$CHROME" --user-data-dir="$PROFILE" --password-store=basic --no-first-run --disable-sync \
    --no-default-browser-check --no-sandbox --start-maximized \
    --window-size=1280,800 https://accounts.google.com/
