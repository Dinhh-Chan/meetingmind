import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
    BotStatusChangedPayload,
    CORE_EVENTS_QUEUE,
    EventEnvelope,
    EventType,
    MEETINGMIND_EXCHANGE,
    RecordingCompletedPayload,
} from "@module/messaging/common/constant";
import { MessageDedupService } from "@module/messaging/services/message-dedup.service";
import { Injectable } from "@nestjs/common";
import { MeetingBotService } from "../services/meeting-bot.service";

const CONSUMER = "core.meeting-bot";

/** Nhận báo cáo của bot-worker; chống xử lý lặp bằng eventId như mọi consumer. */
@Injectable()
export class MeetingBotConsumer {
    constructor(
        private readonly meetingBotService: MeetingBotService,
        private readonly dedup: MessageDedupService,
    ) {}

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.BOT_STATUS_CHANGED,
        queue: `${CORE_EVENTS_QUEUE}.bot-status-changed`,
        queueOptions: { durable: true },
    })
    async onStatusChanged(envelope: EventEnvelope<BotStatusChangedPayload>) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) return;
        await this.meetingBotService.onStatusChanged(envelope.payload);
    }

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.RECORDING_COMPLETED,
        queue: `${CORE_EVENTS_QUEUE}.recording-completed`,
        queueOptions: { durable: true },
    })
    async onRecordingCompleted(envelope: EventEnvelope<RecordingCompletedPayload>) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) return;
        await this.meetingBotService.onRecordingCompleted(envelope.payload);
    }
}
