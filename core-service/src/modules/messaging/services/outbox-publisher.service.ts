import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { OutboxStatus } from "@module/outbox-event/common/constant";
import { OutboxEvent } from "@module/outbox-event/entities/outbox-event.entity";
import { OutboxEventService } from "@module/outbox-event/services/outbox-event.service";
import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { EventEnvelope, MEETINGMIND_EXCHANGE } from "../common/constant";

const BATCH_SIZE = 50;
const MAX_RETRY = 5;

/**
 * Đọc `outbox_events` đang chờ rồi đẩy lên RabbitMQ.
 *
 * Chạy theo chu kỳ thay vì đẩy ngay lúc ghi, để lệnh ghi nghiệp vụ không phụ
 * thuộc vào việc RabbitMQ có sống hay không. RabbitMQ chết thì event nằm lại
 * trong bảng và được đẩy khi nó sống lại.
 */
@Injectable()
export class OutboxPublisherService {
    private readonly logger = new Logger(OutboxPublisherService.name);
    private running = false;

    constructor(
        private readonly outboxEventService: OutboxEventService,
        private readonly amqp: AmqpConnection,
    ) {}

    @Interval(2000)
    async flush() {
        // Không cho hai lượt chồng nhau khi RabbitMQ chậm.
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            const pending = await this.outboxEventService.getMany(
                null,
                { status: OutboxStatus.PENDING },
                { limit: BATCH_SIZE, sort: { createdAt: 1 } } as any,
            );
            for (const event of pending) {
                await this.publishOne(event);
            }
        } catch (err) {
            this.logger.error(`Không đọc được outbox: ${err.message}`);
        } finally {
            this.running = false;
        }
    }

    private async publishOne(event: OutboxEvent) {
        const envelope = event.payload as unknown as EventEnvelope;
        try {
            await this.amqp.publish(
                MEETINGMIND_EXCHANGE,
                event.eventType,
                envelope,
                { messageId: envelope.eventId, persistent: true },
            );
            await this.outboxEventService.updateById(null, event._id, {
                status: OutboxStatus.PUBLISHED,
                publishedAt: new Date(),
            });
            this.logger.log(
                `Đã phát ${event.eventType} (${envelope.eventId})`,
            );
        } catch (err) {
            const retryCount = (event.retryCount ?? 0) + 1;
            await this.outboxEventService.updateById(null, event._id, {
                retryCount,
                // Quá số lần thử thì để lại trạng thái failed cho người kiểm tra,
                // không im lặng bỏ qua.
                ...(retryCount >= MAX_RETRY
                    ? { status: OutboxStatus.FAILED }
                    : {}),
            });
            this.logger.warn(
                `Phát ${event.eventType} lỗi lần ${retryCount}: ${err.message}`,
            );
        }
    }
}
