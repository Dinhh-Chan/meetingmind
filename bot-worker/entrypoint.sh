#!/bin/sh
# Bật màn hình ảo cho Chromium chạy có giao diện (Meet hay chặn headless).
# Không dùng xvfb-run: khi là PID 1 trong container nó treo chờ tín hiệu
# SIGUSR1 từ Xvfb mà không bao giờ nhận được.
set -e

# Docker giữ nguyên hệ thống file khi container khởi động lại (restart:
# unless-stopped), nên khoá X và pid PulseAudio của lần chạy trước vẫn còn. PID
# trong container đánh lại từ nhỏ, Xvfb mới hay trùng đúng PID ghi trong khoá cũ,
# tưởng màn hình :99 đang có người dùng rồi tự thoát; socket cũ vẫn còn nên vòng
# chờ bên dưới không phát hiện, Chromium mở ra không có màn hình và chết ngay
# (TargetClosedError, "headed browser without having a XServer running").
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
rm -rf /tmp/pulse-* "${HOME:-/root}"/.config/pulse/*-runtime

Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 &
XVFB_PID=$!
export DISPLAY=:99
for i in $(seq 1 50); do
    [ -e /tmp/.X11-unix/X99 ] && break
    sleep 0.1
done
# Không có màn hình thì bot chắc chắn hỏng: dừng để Docker khởi động lại, thay vì
# nhận lệnh rồi báo lỗi cho từng cuộc họp.
if ! kill -0 "$XVFB_PID" 2>/dev/null || [ ! -e /tmp/.X11-unix/X99 ]; then
    echo "Không bật được màn hình ảo Xvfb :99" >&2
    exit 1
fi

# Loa ảo cho Chrome (xem Dockerfile). Chỉ trong container, không đụng máy chủ.
pulseaudio --daemonize=yes --exit-idle-time=-1 --disallow-exit --log-target=stderr >/dev/null 2>&1 || true
pactl load-module module-null-sink sink_name=mm_null sink_properties=device.description=MeetingMindNull >/dev/null 2>&1 || true
pactl set-default-sink mm_null >/dev/null 2>&1 || true
# Loa ảo không "ngủ" khi im lặng: bot ghi từ monitor của nó, ngủ thì các khoảng
# lặng bị bỏ khỏi bản ghi và mốc thời gian transcript lệch so với cuộc họp.
pactl unload-module module-suspend-on-idle >/dev/null 2>&1 || true
# Container trước bị dừng đột ngột có thể để lại khoá hồ sơ Chromium; mỗi lúc
# chỉ một phiên dùng hồ sơ nên xoá khoá cũ là an toàn.
if [ -n "$BOT_PROFILE_DIR" ] && [ -d "$BOT_PROFILE_DIR" ]; then
    rm -f "$BOT_PROFILE_DIR"/Singleton*
fi
exec "$@"
