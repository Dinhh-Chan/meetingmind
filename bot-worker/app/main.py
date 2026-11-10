"""bot-worker: nhận lệnh từ Core qua RabbitMQ, vào Google Meet, ghi âm, báo lại.

Không ghi vào bảng nghiệp vụ: chỉ phát bot.status.changed và
recording.completed, Core quyết định phần còn lại (ARCHITECTURE mục 3.4).
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import aio_pika

from app import contracts as c
from app.meet import BotOptions, JoinError, MeetBot, Status
from app.storage import bucket, upload

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s [bot-worker] %(message)s")
log = logging.getLogger("bot-worker")

WORK_DIR = Path(os.environ.get("BOT_WORK_DIR", "/tmp/mm-bot"))
# Bản ghi nhỏ hơn ngần này là gần như chỉ có phần đầu tệp FLAC.
MIN_RECORDING_BYTES = int(os.environ.get("BOT_MIN_RECORDING_BYTES", "4096"))


def options_from_env() -> BotOptions:
    env = os.environ.get
    profile = env("BOT_PROFILE_DIR")
    debug = env("BOT_DEBUG_DIR")
    return BotOptions(
        name=env("BOT_NAME", "MeetingMind Bot"),
        admission_timeout_s=float(env("BOT_ADMISSION_TIMEOUT_S", "300")),
        alone_timeout_s=float(env("BOT_ALONE_TIMEOUT_S", "60")),
        max_duration_s=float(env("BOT_MAX_DURATION_S", str(4 * 3600))),
        profile_dir=Path(profile) if profile and Path(profile).exists() else None,
        debug_dir=Path(debug) if debug else None,
    )


class Worker:
    def __init__(self, exchange: aio_pika.abc.AbstractExchange) -> None:
        self.exchange = exchange
        # Phiên đang chạy → cờ dừng; phiên bị dừng trước khi kịp chạy.
        self.running: dict[str, asyncio.Event] = {}
        self.cancelled: set[str] = set()
        # Đã ack sớm nên RabbitMQ giao lệnh kế tiếp ngay; một hồ sơ Chromium chỉ
        # mở được một lần, nên các phiên chạy lần lượt.
        self.session_lock = asyncio.Lock()

    async def publish(self, event_type: str, workspace_id: str, correlation_id: str, payload: dict) -> None:
        env = c.envelope(event_type, workspace_id, correlation_id, payload)
        await self.exchange.publish(
            aio_pika.Message(
                body=json.dumps(env).encode(),
                message_id=env["eventId"],
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=event_type,
        )

    async def on_stop(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            session_id = json.loads(message.body)["payload"]["botSessionId"]
            log.info("Nhận lệnh dừng %s", session_id)
            if session_id in self.running:
                self.running[session_id].set()
            else:
                self.cancelled.add(session_id)

    async def on_join(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        # Ack ngay: một phiên kéo dài hàng giờ, quá consumer_timeout của RabbitMQ
        # (30 phút) thì broker đóng kênh. Lỗi đã báo về Core bằng status failed.
        await message.ack()
        env = json.loads(message.body)
        p = env["payload"]
        session_id, meeting_id = p["botSessionId"], p["meetingId"]
        workspace_id, correlation = env["workspaceId"], env["correlationId"]

        async def status(s: Status, detail: str | None = None, error: str | None = None) -> None:
            payload = {"botSessionId": session_id, "meetingId": meeting_id, "status": s.value}
            if detail:
                payload["detail"] = detail
            if error:
                payload["error"] = error
            await self.publish(c.BOT_STATUS_CHANGED, workspace_id, correlation, payload)

        async with self.session_lock:
            if session_id in self.cancelled:
                log.info("Bỏ qua phiên đã huỷ %s", session_id)
                return
            await self._run_session(session_id, meeting_id, workspace_id, correlation, p["joinUrl"], status)

    async def _run_session(self, session_id, meeting_id, workspace_id, correlation, join_url, status) -> None:
        stop = asyncio.Event()
        self.running[session_id] = stop
        output = WORK_DIR / f"{session_id}.flac"
        try:
            bot = MeetBot(join_url, output, options_from_env(), on_status=status, stop_event=stop)
            result = await bot.run()
            if result.bytes < MIN_RECORDING_BYTES:
                log.warning("Bản ghi %s quá nhỏ (%d byte), không gửi phiên âm", session_id, result.bytes)
                return
            object_key = f"{workspace_id}/{meeting_id}/bot-{session_id}.flac"
            await asyncio.to_thread(upload, output, object_key, "audio/flac")
            await self.publish(
                c.RECORDING_COMPLETED,
                workspace_id,
                correlation,
                {
                    "botSessionId": session_id,
                    "meetingId": meeting_id,
                    "bucket": bucket(),
                    "objectKey": object_key,
                    "durationMs": result.duration_ms,
                    "sizeBytes": result.bytes,
                    "endReason": result.end_reason.value,
                },
            )
            log.info("Đã gửi bản ghi %s (%d byte)", object_key, result.bytes)
        except JoinError as err:
            await status(Status.FAILED, error=str(err))
        except Exception as err:  # noqa: BLE001 - lỗi nào cũng phải báo về Core
            log.exception("Phiên bot %s lỗi", session_id)
            await status(Status.FAILED, error=f"{type(err).__name__}: {err}")
        finally:
            self.running.pop(session_id, None)
            output.unlink(missing_ok=True)


async def main() -> None:
    log.info("Kết nối RabbitMQ: %s", c.RABBITMQ_URL)
    connection = await aio_pika.connect_robust(c.RABBITMQ_URL)
    async with connection:
        # Hai kênh: kênh việc chỉ nhận một phiên một lúc (một hồ sơ Chromium
        # không mở được hai lần); kênh điều khiển luôn rảnh để nhận lệnh dừng.
        jobs = await connection.channel()
        await jobs.set_qos(prefetch_count=1)
        control = await connection.channel()

        exchange = await jobs.declare_exchange(c.EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
        worker = Worker(exchange)

        jobs_queue = await jobs.declare_queue(c.BOT_JOBS_QUEUE, durable=True)
        await jobs_queue.bind(c.EXCHANGE, c.BOT_JOIN_REQUESTED)
        control_exchange = await control.declare_exchange(c.EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
        control_queue = await control.declare_queue(c.BOT_CONTROL_QUEUE, durable=True)
        await control_queue.bind(control_exchange, c.BOT_STOP_REQUESTED)

        await control_queue.consume(worker.on_stop)
        await jobs_queue.consume(worker.on_join)
        log.info("Đang chờ lệnh trên %s, %s", c.BOT_JOBS_QUEUE, c.BOT_CONTROL_QUEUE)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
