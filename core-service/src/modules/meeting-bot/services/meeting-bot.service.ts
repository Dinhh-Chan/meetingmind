import { ApiError } from "@config/exception/api-error";
import { BotSessionStatus } from "@module/bot-session/common/constant";
import { BotSession } from "@module/bot-session/entities/bot-session.entity";
import { BotSessionService } from "@module/bot-session/services/bot-session.service";
import { MediaFileUploadService } from "@module/media-file/services/media-file-upload.service";
import { MeetingProcessingService } from "@module/meeting-processing/services/meeting-processing.service";
import { MeetingStatus } from "@module/meeting/common/constant";
import { MeetingService } from "@module/meeting/services/meeting.service";
import {
    BotStatusChangedPayload,
    EventType,
    RecordingCompletedPayload,
} from "@module/messaging/common/constant";
import { OutboxService } from "@module/messaging/services/outbox.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { Injectable, Logger } from "@nestjs/common";

/** Phiên còn đang chạy: chưa kết thúc theo cách nào. */
const ACTIVE: string[] = [
    BotSessionStatus.QUEUED,
    BotSessionStatus.JOINING,
    BotSessionStatus.WAITING_ADMISSION,
    BotSessionStatus.RECORDING,
];
const TERMINAL: string[] = [
    BotSessionStatus.LEFT,
    BotSessionStatus.FAILED,
    BotSessionStatus.CANCELLED,
];

/** Bot chỉ hỗ trợ Google Meet (ARCHITECTURE mục "Tiếp theo": bot cho một nền tảng). */
const MEET_URL = /^https:\/\/meet\.google\.com\/[a-z0-9-]+/i;

/**
 * Bot ghi âm cuộc họp trực tuyến. Core giữ bot_sessions và quyết định mọi thứ;
 * bot-worker chỉ nhận lệnh, vào phòng, ghi âm rồi báo lại bằng sự kiện
 * (ARCHITECTURE mục 3.4). Bản ghi đi tiếp đúng đường upload: MinIO → Whisper.
 */
@Injectable()
export class MeetingBotService {
    private readonly logger = new Logger(MeetingBotService.name);

    constructor(
        private readonly permissionService: PermissionService,
        private readonly meetingService: MeetingService,
        private readonly botSessionService: BotSessionService,
        private readonly outboxService: OutboxService,
        private readonly mediaFileUploadService: MediaFileUploadService,
        private readonly meetingProcessingService: MeetingProcessingService,
    ) {}

    private async meetingFor(userId: string, meetingId: string) {
        const meeting = await this.meetingService.getOne(null, {
            _id: meetingId,
            deletedAt: null,
        });
        if (!meeting) throw ApiError.NotFound("error-meeting-not-found");
        await this.permissionService.assertOnMeeting(
            userId,
            meeting,
            Permission.MEETING_RECORDING_CONTROL,
        );
        return meeting;
    }

    private async latest(meetingId: string): Promise<BotSession | null> {
        const sessions = await this.botSessionService.getMany(null, { meetingId });
        return (
            [...sessions].sort(
                (a, b) =>
                    new Date((b as { createdAt?: Date }).createdAt ?? 0).getTime() -
                    new Date((a as { createdAt?: Date }).createdAt ?? 0).getTime(),
            )[0] ?? null
        );
    }

    async getBot(userId: string, meetingId: string) {
        const meeting = await this.meetingService.getOne(null, { _id: meetingId });
        if (!meeting) throw ApiError.NotFound("error-meeting-not-found");
        await this.permissionService.assertOnMeeting(userId, meeting, Permission.MEETING_VIEW);
        return this.latest(meetingId);
    }

    /** Mời bot vào phòng ngay. Gọi lại khi bot đang chạy thì trả về phiên đó. */
    async invite(userId: string, meetingId: string) {
        const meeting = await this.meetingFor(userId, meetingId);
        if (!meeting.meetingUrl || !MEET_URL.test(meeting.meetingUrl)) {
            throw ApiError.BadRequest("error-meeting-url-required");
        }
        const current = await this.latest(meetingId);
        if (current && ACTIVE.includes(current.status)) return current;

        const session = await this.botSessionService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId,
            status: BotSessionStatus.QUEUED,
            joinUrl: meeting.meetingUrl,
            attempt: (current?.attempt ?? 0) + 1,
            requestedById: userId,
        });
        await this.outboxService.emit({
            aggregateType: "bot_session",
            aggregateId: session._id,
            eventType: EventType.BOT_JOIN_REQUESTED,
            workspaceId: meeting.workspaceId,
            correlationId: meetingId,
            payload: {
                botSessionId: session._id,
                meetingId,
                joinUrl: meeting.meetingUrl,
            },
        });
        return session;
    }

    async stop(userId: string, meetingId: string) {
        const meeting = await this.meetingFor(userId, meetingId);
        const current = await this.latest(meetingId);
        if (!current || !ACTIVE.includes(current.status)) {
            throw ApiError.NotFound("error-bot-session-not-found");
        }
        await this.outboxService.emit({
            aggregateType: "bot_session",
            aggregateId: current._id,
            eventType: EventType.BOT_STOP_REQUESTED,
            workspaceId: meeting.workspaceId,
            correlationId: meetingId,
            payload: { botSessionId: current._id },
        });
        // Chưa vào phòng thì huỷ luôn; đang trong phòng thì chờ bot báo "left"
        // kèm bản ghi.
        if (current.status === BotSessionStatus.QUEUED) {
            return this.botSessionService.updateById(null, current._id, {
                status: BotSessionStatus.CANCELLED,
                endedAt: new Date(),
            });
        }
        return current;
    }

    /** Bot báo trạng thái. Sự kiện có thể tới trễ: không lùi trạng thái đã kết thúc. */
    async onStatusChanged(payload: BotStatusChangedPayload) {
        const session = await this.botSessionService.getById(null, payload.botSessionId);
        if (!session) {
            this.logger.warn(`Không thấy bot_session ${payload.botSessionId}`);
            return;
        }
        if (TERMINAL.includes(session.status)) return;

        const now = new Date();
        const update: Record<string, unknown> = {
            status: payload.status,
            heartbeatAt: now,
        };
        if (payload.status === BotSessionStatus.RECORDING) update.startedAt = now;
        if (TERMINAL.includes(payload.status)) update.endedAt = now;
        if (payload.error || payload.detail) update.error = payload.error ?? payload.detail;
        await this.botSessionService.updateById(null, session._id, update);

        const meeting = await this.meetingService.getOne(null, { _id: session.meetingId });
        if (!meeting) return;
        if (payload.status === BotSessionStatus.RECORDING) {
            await this.meetingService.updateById(null, meeting._id, {
                status: MeetingStatus.IN_PROGRESS,
                actualStartAt: meeting.actualStartAt ?? now,
            });
        } else if (payload.status === BotSessionStatus.LEFT && meeting.status === MeetingStatus.IN_PROGRESS) {
            await this.meetingService.updateById(null, meeting._id, {
                status: MeetingStatus.ENDED,
                actualEndAt: now,
            });
        }
    }

    /** Bot đã đẩy bản ghi lên MinIO: ghi nhận file rồi đi tiếp đường phiên âm. */
    async onRecordingCompleted(payload: RecordingCompletedPayload) {
        const session = await this.botSessionService.getById(null, payload.botSessionId);
        if (!session) {
            this.logger.warn(`Không thấy bot_session ${payload.botSessionId}`);
            return;
        }
        const file = await this.mediaFileUploadService.registerExisting({
            workspaceId: session.workspaceId,
            meetingId: session.meetingId,
            botSessionId: session._id,
            bucket: payload.bucket,
            objectKey: payload.objectKey,
            durationMs: payload.durationMs,
        });
        this.logger.log(
            `Bản ghi bot ${session._id}: ${payload.sizeBytes} byte, ${payload.durationMs} ms (${payload.endReason})`,
        );
        return this.meetingProcessingService.startTranscription({
            meetingId: session.meetingId,
            bucket: payload.bucket,
            objectKey: payload.objectKey,
            fileId: file._id,
            recordedById: session.requestedById,
        });
    }
}
