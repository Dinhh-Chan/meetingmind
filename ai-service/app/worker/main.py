"""Worker của ai-service: nhận lệnh từ Core qua RabbitMQ, trả kết quả.

AI không ghi thẳng vào bảng nghiệp vụ. Nó tính toán rồi phát sự kiện; Core
quyết định kết quả đó có thành dữ liệu chính thức hay không.
Xem ARCHITECTURE.md mục 3.4.
"""

import asyncio
import json
import logging
import os

import aio_pika

from app.worker import contracts as c
from app.worker.analyzer import get_analyzer
from app.worker.transcriber import get_transcriber

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s [ai-worker] %(message)s",
)
log = logging.getLogger("ai-worker")

PREFETCH = int(os.environ.get("AI_WORKER_PREFETCH", "1"))


async def handle_transcription(
    message: aio_pika.IncomingMessage, channel: aio_pika.abc.AbstractChannel
) -> None:
    env = json.loads(message.body)
    payload = env["payload"]
    log.info("Nhận lệnh phiên âm job=%s meeting=%s", payload["jobId"], payload["meetingId"])

    try:
        transcriber = get_transcriber()
        result = await transcriber.transcribe(
            bucket=payload["bucket"],
            object_key=payload["objectKey"],
            language=payload.get("language", "vi"),
        )
        out = c.envelope(
            c.TRANSCRIPTION_COMPLETED,
            env["workspaceId"],
            env["correlationId"],
            {
                "jobId": payload["jobId"],
                "meetingId": payload["meetingId"],
                "runId": result.run_id,
                "model": result.model,
                "segments": result.segments,
            },
        )
        routing_key = c.TRANSCRIPTION_COMPLETED
        log.info("Phiên âm xong: %d đoạn", len(result.segments))
    except Exception as err:  # noqa: BLE001 - lỗi nào cũng phải báo về Core
        log.exception("Phiên âm lỗi")
        out = c.envelope(
            c.TRANSCRIPTION_FAILED,
            env["workspaceId"],
            env["correlationId"],
            {
                "jobId": payload["jobId"],
                "meetingId": payload["meetingId"],
                "error": str(err),
            },
        )
        routing_key = c.TRANSCRIPTION_FAILED

    await publish(channel, routing_key, out)


async def handle_analysis(
    message: aio_pika.IncomingMessage, channel: aio_pika.abc.AbstractChannel
) -> None:
    env = json.loads(message.body)
    payload = env["payload"]
    log.info("Nhận lệnh phân tích job=%s meeting=%s", payload["jobId"], payload["meetingId"])

    try:
        analyzer = get_analyzer()
        result = await analyzer.analyze(
            meeting_id=payload["meetingId"],
            transcript_version_id=payload["transcriptVersionId"],
            language=payload.get("language", "vi"),
        )
        out = c.envelope(
            c.ANALYSIS_COMPLETED,
            env["workspaceId"],
            env["correlationId"],
            {
                "jobId": payload["jobId"],
                "meetingId": payload["meetingId"],
                "transcriptVersionId": payload["transcriptVersionId"],
                "runId": result.run_id,
                "model": result.model,
                "summary": result.summary,
                "openIssues": result.open_issues,
                "decisions": result.decisions,
                "actionItems": result.action_items,
            },
        )
        routing_key = c.ANALYSIS_COMPLETED
        log.info(
            "Phân tích xong: %d công việc, %d quyết định",
            len(result.action_items),
            len(result.decisions),
        )
    except Exception as err:  # noqa: BLE001
        log.exception("Phân tích lỗi")
        out = c.envelope(
            c.ANALYSIS_FAILED,
            env["workspaceId"],
            env["correlationId"],
            {
                "jobId": payload["jobId"],
                "meetingId": payload["meetingId"],
                "error": str(err),
            },
        )
        routing_key = c.ANALYSIS_FAILED

    await publish(channel, routing_key, out)


async def publish(
    channel: aio_pika.abc.AbstractChannel, routing_key: str, envelope: dict
) -> None:
    exchange = await channel.declare_exchange(
        c.EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
    )
    await exchange.publish(
        aio_pika.Message(
            body=json.dumps(envelope).encode(),
            message_id=envelope["eventId"],
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        ),
        routing_key=routing_key,
    )


HANDLERS = {
    c.TRANSCRIPTION_REQUESTED: handle_transcription,
    c.ANALYSIS_REQUESTED: handle_analysis,
}


async def main() -> None:
    log.info("Kết nối RabbitMQ: %s", c.RABBITMQ_URL)
    connection = await aio_pika.connect_robust(c.RABBITMQ_URL)

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=PREFETCH)
        exchange = await channel.declare_exchange(
            c.EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )
        queue = await channel.declare_queue(c.AI_JOBS_QUEUE, durable=True)
        for routing_key in HANDLERS:
            await queue.bind(exchange, routing_key)
        log.info("Đang chờ việc trên %s: %s", c.AI_JOBS_QUEUE, list(HANDLERS))

        async with queue.iterator() as messages:
            async for message in messages:
                # Ack sau khi xử lý xong; lỗi cũng ack vì đã báo về Core bằng
                # sự kiện *.failed, requeue chỉ tạo vòng lặp vô ích.
                async with message.process(requeue=False):
                    env = json.loads(message.body)
                    handler = HANDLERS.get(env.get("eventType"))
                    if handler is None:
                        log.warning("Bỏ qua sự kiện lạ: %s", env.get("eventType"))
                        continue
                    await handler(message, channel)


if __name__ == "__main__":
    asyncio.run(main())
