#!/bin/sh
# Bật màn hình ảo cho Chromium chạy có giao diện (Meet hay chặn headless).
# Không dùng xvfb-run: khi là PID 1 trong container nó treo chờ tín hiệu
# SIGUSR1 từ Xvfb mà không bao giờ nhận được.
set -e
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 &
export DISPLAY=:99
for i in $(seq 1 50); do
    [ -e /tmp/.X11-unix/X99 ] && break
    sleep 0.1
done

# Loa ảo cho Chrome (xem Dockerfile). Chỉ trong container, không đụng máy chủ.
pulseaudio --daemonize=yes --exit-idle-time=-1 --disallow-exit --log-target=stderr >/dev/null 2>&1 || true
pactl load-module module-null-sink sink_name=mm_null sink_properties=device.description=MeetingMindNull >/dev/null 2>&1 || true
pactl set-default-sink mm_null >/dev/null 2>&1 || true
# Container trước bị dừng đột ngột có thể để lại khoá hồ sơ Chromium; mỗi lúc
# chỉ một phiên dùng hồ sơ nên xoá khoá cũ là an toàn.
if [ -n "$BOT_PROFILE_DIR" ] && [ -d "$BOT_PROFILE_DIR" ]; then
    rm -f "$BOT_PROFILE_DIR"/Singleton*
fi
exec "$@"
