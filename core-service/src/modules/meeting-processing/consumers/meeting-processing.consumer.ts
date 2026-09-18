import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
    AnalysisCompletedPayload,
    CORE_EVENTS_QUEUE,
    EventEnvelope,
    EventType,
    JobFailedPayload,
    MEETINGMIND_EXCHANGE,
    TranscriptionCompletedPayload,
} from "@module/messaging/common/constant";
import { MessageDedupService } from "@module/messaging/services/message-dedup.service";
import { Injectable, Logger } from "@nestjs/common";
import { MeetingProcessingService } from "../services/meeting-processing.service";

const CONSUMER = "core.meeting-processing";

/**
 * Nhận kết quả AI trả về. Mỗi handler chống xử lý lặp bằng eventId trước khi
 * đụng vào dữ liệu — RabbitMQ chỉ đảm bảo at-least-once.
 */
@Injectable()
export class MeetingProcessingConsumer {
    private readonly logger = new Logger(MeetingProcessingConsumer.name);

    constructor(
        private readonly meetingProcessingService: MeetingProcessingService,
        private readonly dedup: MessageDedupService,
    ) {}

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.TRANSCRIPTION_COMPLETED,
        queue: `${CORE_EVENTS_QUEUE}.transcription-completed`,
        queueOptions: { durable: true },
    })
    async onTranscriptionCompleted(
        envelope: EventEnvelope<TranscriptionCompletedPayload>,
    ) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
            return;
        }
        await this.meetingProcessingService.onTranscriptionCompleted(
            envelope.payload,
        );
    }

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.ANALYSIS_COMPLETED,
        queue: `${CORE_EVENTS_QUEUE}.analysis-completed`,
        queueOptions: { durable: true },
    })
    async onAnalysisCompleted(
        envelope: EventEnvelope<AnalysisCompletedPayload>,
    ) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
            return;
        }
        await this.meetingProcessingService.onAnalysisCompleted(
            envelope.payload,
        );
    }

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.TRANSCRIPTION_FAILED,
        queue: `${CORE_EVENTS_QUEUE}.transcription-failed`,
        queueOptions: { durable: true },
    })
    async onTranscriptionFailed(envelope: EventEnvelope<JobFailedPayload>) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
            return;
        }
        await this.meetingProcessingService.onJobFailed(envelope.payload);
    }

    @RabbitSubscribe({
        exchange: MEETINGMIND_EXCHANGE,
        routingKey: EventType.ANALYSIS_FAILED,
        queue: `${CORE_EVENTS_QUEUE}.analysis-failed`,
        queueOptions: { durable: true },
    })
    async onAnalysisFailed(envelope: EventEnvelope<JobFailedPayload>) {
        if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
            return;
        }
        await this.meetingProcessingService.onJobFailed(envelope.payload);
    }
}
