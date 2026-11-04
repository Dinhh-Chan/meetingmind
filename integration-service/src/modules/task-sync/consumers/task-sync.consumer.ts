import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
    EventEnvelope,
    EventType,
    INTEGRATION_JOBS_QUEUE,
    MEETINGMIND_EXCHANGE,
    TaskSyncRequestedPayload,
} from "@module/messaging/common/constant";
import { MessageDedupService } from "@module/messaging/services/message-dedup.service";
import { Injectable, Logger } from "@nestjs/common";
import { TaskSyncService } from "../services/task-sync.service";

const CONSUMER = "integration.task-sync";

/**
 * Chờ một nhịp trước khi trả tin về queue. Lỗi tới được đây là DB/RabbitMQ
 * chập chờn; requeue ngay thì tin quay vòng liên tục và tràn log.
 */
const RETRY_DELAY_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Nhận công việc đã duyệt từ Core. Chống xử lý lặp bằng eventId trước khi
 * đụng vào dữ liệu — RabbitMQ chỉ đảm bảo at-least-once.
 */
@Injectable()
export class TaskSyncConsumer {
    private readonly logger = new Logger(TaskSyncConsumer.name);

    constructor(
        private readonly taskSyncService: TaskSyncService,
        private readonly dedup: MessageDedupService,
    ) {}

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.TASK_SYNC_REQUESTED,
        queue: `${INTEGRATION_JOBS_QUEUE}.task-sync`,
        queueOptions: { durable: true },
    })
    async onTaskSyncRequested(
        envelope: EventEnvelope<TaskSyncRequestedPayload>,
    ) {
        const payload = envelope?.payload;
        if (
            !envelope?.eventId ||
            !payload?.actionItemId ||
            !payload?.idempotencyKey ||
            !payload?.task?.title
        ) {
            // Tin sai định dạng thì giao lại bao nhiêu lần cũng sai: bỏ, không requeue.
            this.logger.error(
                `Bỏ tin ${EventType.TASK_SYNC_REQUESTED} sai định dạng (eventId=${envelope?.eventId})`,
            );
            return;
        }
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
            return;
        }
        try {
            await this.taskSyncService.handle(envelope);
        } catch (err) {
            this.logger.error(
                `Đồng bộ công việc ${payload.actionItemId} lỗi, sẽ giao lại: ${this.taskSyncService.redact(err?.message || String(err))}`,
            );
            // Trả claim để lần giao lại không bị coi là trùng.
            await this.dedup
                .release(envelope.eventId, CONSUMER)
                .catch(() => undefined);
            await sleep(RETRY_DELAY_MS);
            throw err;
        }
    }
}
