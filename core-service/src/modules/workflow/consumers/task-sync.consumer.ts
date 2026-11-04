import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
    CORE_EVENTS_QUEUE,
    EventEnvelope,
    EventType,
    MEETINGMIND_EXCHANGE,
    TaskSyncCompletedPayload,
} from "@module/messaging/common/constant";
import { MessageDedupService } from "@module/messaging/services/message-dedup.service";
import { Injectable } from "@nestjs/common";
import { WorkflowService } from "../services/workflow.service";

const CONSUMER = "core.task-sync";

/** Nhận kết quả đồng bộ công việc ra Trello/Telegram từ integration-service. */
@Injectable()
export class TaskSyncConsumer {
    constructor(
        private readonly workflowService: WorkflowService,
        private readonly dedup: MessageDedupService,
    ) {}

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.TASK_SYNC_COMPLETED,
        queue: `${CORE_EVENTS_QUEUE}.task-sync-completed`,
        queueOptions: { durable: true },
    })
    async onTaskSyncCompleted(envelope: EventEnvelope<TaskSyncCompletedPayload>) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
            return;
        }
        await this.workflowService.onTaskSyncCompleted(envelope.payload);
    }
}
