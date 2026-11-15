"""Container mất GPU giữa chừng thì tự khởi động lại để lấy lại GPU.

Trên máy 5880, container đôi khi mất quyền dùng GPU trong khi máy chủ vẫn thấy GPU
("no CUDA-capable device is detected"). Whisper khi đó chạy tạm bằng CPU (chậm, và
lượt sửa từ tiếng Việt bị bỏ) cho tới khi container được khởi động lại. Ở đây: xong
việc đang làm thì thoát tiến trình để Docker khởi động lại (restart: unless-stopped).
Giới hạn số lần trong một giờ để GPU hỏng thật thì không khởi động lại mãi.
"""

from __future__ import annotations

import json
import logging
import os
import time

log = logging.getLogger("ai-worker")

# Hệ thống tệp của container còn qua lần khởi động lại (chỉ mất khi dựng lại container).
STATE_PATH = os.environ.get("AI_GPU_RESTART_STATE", "/tmp/mm-gpu-restarts.json")
LIMIT = int(os.environ.get("AI_GPU_RESTART_LIMIT", "3"))
WINDOW_S = 3600.0

lost = False


def mark_lost(err: BaseException | str) -> None:
    global lost
    if not lost:
        log.warning("Mất GPU: %s", err)
    lost = True


def should_restart(now: float | None = None, path: str = STATE_PATH, limit: int = LIMIT, window_s: float = WINDOW_S) -> bool:
    """Còn lượt khởi động lại trong giờ này không; có thì ghi nhận lượt này."""
    now = time.time() if now is None else now
    try:
        with open(path, encoding="utf-8") as f:
            stamps = [float(x) for x in json.load(f)]
    except (OSError, ValueError, TypeError):
        stamps = []
    stamps = [x for x in stamps if now - x < window_s]
    if len(stamps) >= limit:
        return False
    stamps.append(now)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(stamps, f)
    except OSError:
        return False
    return True


def restart_if_lost() -> None:
    """Gọi khi đã xong việc đang làm (tin đã ack, câu trả lời đã gửi)."""
    if not lost:
        return
    if should_restart():
        log.error("Khởi động lại tiến trình để lấy lại GPU")
        logging.shutdown()
        os._exit(75)
    log.error("Đã khởi động lại %d lần trong một giờ mà vẫn mất GPU: chạy tiếp bằng CPU", LIMIT)
