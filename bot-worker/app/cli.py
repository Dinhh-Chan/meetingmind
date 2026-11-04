"""Chạy thử một phiên bot bằng tay, không qua RabbitMQ.

    xvfb-run python -m app.cli https://meet.google.com/abc-defg-hij --out /out/rec.webm --debug /out/shots
"""

import argparse
import asyncio
import logging
from pathlib import Path

from app.meet import BotOptions, MeetBot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--out", type=Path, default=Path("/tmp/mm-bot/recording.webm"))
    parser.add_argument("--debug", type=Path, default=None, help="thư mục lưu ảnh chụp từng bước")
    parser.add_argument("--max", type=float, default=600, help="giây ghi tối đa")
    parser.add_argument("--alone", type=float, default=60)
    parser.add_argument("--profile", type=Path, default=None, help="hồ sơ Chromium đã đăng nhập (login.sh)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s [bot] %(message)s")
    options = BotOptions(
        debug_dir=args.debug, max_duration_s=args.max, alone_timeout_s=args.alone, profile_dir=args.profile
    )
    result = asyncio.run(MeetBot(args.url, args.out, options).run())
    print(f"Xong: {result.end_reason.value}, {result.bytes} byte, {result.duration_ms / 1000:.1f}s → {result.path}")
    print(f"Thống kê cuối: {result.stats}")


if __name__ == "__main__":
    main()
