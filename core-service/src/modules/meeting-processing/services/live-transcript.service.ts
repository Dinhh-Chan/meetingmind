import { ApiError } from "@config/exception/api-error";
import {
    MeetingAccessScope,
    MeetingSourceType,
    MeetingStatus,
} from "@module/meeting/common/constant";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { SpeakerAliasService } from "@module/speaker-alias/services/speaker-alias.service";
import { SpeakerIdentityStatus } from "@module/transcript-segment/common/constant";
import { TranscriptSegmentService } from "@module/transcript-segment/services/transcript-segment.service";
import { TranscriptVersionSource } from "@module/transcript-version/common/constant";
import { TranscriptVersionService } from "@module/transcript-version/services/transcript-version.service";
import { Injectable, Logger } from "@nestjs/common";
import { MeetingProcessingService } from "./meeting-processing.service";

export interface LiveSegmentInput {
    /** Nhãn ổn định trong một cuộc họp, thường chính là tên hiển thị. */
    speakerLabel: string;
    /** Tên hiển thị nền tảng trả về, nếu có. */
    displayName?: string;
    startMs: number;
    endMs: number;
    text: string;
}

export interface StartLiveSessionInput {
    workspaceId: string;
    meetingUrl: string;
    title?: string;
    language?: string;
    platform?: string;
    createdById: string;
}

/**
 * Nhận transcript do extension đọc từ phụ đề của nền tảng.
 *
 * Khác đường bot/upload ở chỗ **không qua STT và không có audio**: nền tảng đã
 * phiên âm sẵn và kèm luôn tên người nói. Từ `transcript_versions` trở đi thì
 * dùng chung y hệt hai đường kia.
 */
@Injectable()
export class LiveTranscriptService {
    private readonly logger = new Logger(LiveTranscriptService.name);

    constructor(
        private readonly meetingService: MeetingService,
        private readonly transcriptVersionService: TranscriptVersionService,
        private readonly transcriptSegmentService: TranscriptSegmentService,
        private readonly speakerAliasService: SpeakerAliasService,
        private readonly meetingProcessingService: MeetingProcessingService,
    ) {}

    /**
     * Một thao tác cho extension: tìm cuộc họp theo link, chưa có thì tạo.
     * Nhờ vậy người dùng chỉ cần bấm một nút trong phòng họp.
     */
    async startSession(input: StartLiveSessionInput) {
        const existing = await this.meetingService.getOne(null, {
            workspaceId: input.workspaceId,
            meetingUrl: input.meetingUrl,
            sourceType: MeetingSourceType.LIVE_CAPTION,
        });
        if (existing) {
            await this.meetingService.updateById(null, existing._id, {
                status: MeetingStatus.IN_PROGRESS,
                actualStartAt: existing.actualStartAt ?? new Date(),
            });
            return existing;
        }

        return this.meetingService.create(null, {
            workspaceId: input.workspaceId,
            title: input.title || "Cuộc họp chưa đặt tên",
            sourceType: MeetingSourceType.LIVE_CAPTION,
            meetingUrl: input.meetingUrl,
            platform: input.platform as any,
            language: input.language || "vi",
            accessScope: MeetingAccessScope.RESTRICTED,
            status: MeetingStatus.IN_PROGRESS,
            actualStartAt: new Date(),
            createdById: input.createdById,
        });
    }

    /**
     * Ghi thêm một lô đoạn phụ đề.
     *
     * Nhận theo lô ngay từ đầu để sau này bật transcript thời gian thực không
     * phải đổi API — extension chỉ cần gửi dày hơn.
     */
    async appendSegments(
        meetingId: string,
        segments: LiveSegmentInput[],
    ): Promise<{ transcriptVersionId: string; appended: number }> {
        const meeting = await this.meetingService.getOne(null, {
            _id: meetingId,
        });
        if (!meeting) {
            throw ApiError.NotFound("error-meeting-not-found");
        }

        const version = await this.getOrCreateLiveVersion(meeting);

        const existingCount = (
            await this.transcriptSegmentService.getMany(
                null,
                { transcriptVersionId: version._id },
                {} as any,
            )
        ).length;

        let sequence = existingCount;
        for (const segment of segments) {
            sequence += 1;
            await this.transcriptSegmentService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
                transcriptVersionId: version._id,
                speakerLabel: segment.speakerLabel,
                // Tên hiển thị của nền tảng là căn cứ mạnh hơn diarization,
                // nhưng vẫn không phải bằng chứng danh tính chắc chắn — người
                // dùng đặt tên gì cũng được. Giữ ở mức "đề xuất" cho tới khi
                // chủ trì xác nhận (tài liệu nghiệp vụ mục 6.5).
                identityStatus: segment.displayName
                    ? SpeakerIdentityStatus.SUGGESTED
                    : SpeakerIdentityStatus.UNKNOWN,
                startMs: segment.startMs,
                endMs: segment.endMs,
                text: segment.text,
                rawText: segment.text,
                sequence,
            });

            if (segment.displayName) {
                await this.upsertAlias(
                    meeting,
                    version._id,
                    segment.speakerLabel,
                    segment.displayName,
                );
            }
        }

        return {
            transcriptVersionId: version._id,
            appended: segments.length,
        };
    }

    /** Chốt phiên: đóng cuộc họp rồi xin AI phân tích. */
    async finalize(meetingId: string) {
        const meeting = await this.meetingService.getOne(null, {
            _id: meetingId,
        });
        if (!meeting) {
            throw ApiError.NotFound("error-meeting-not-found");
        }

        const version = await this.getOrCreateLiveVersion(meeting);

        await this.meetingService.updateById(null, meeting._id, {
            status: MeetingStatus.ENDED,
            actualEndAt: new Date(),
        });

        // Dùng lại đúng đường mà bot và upload đi: phân tích, biên bản nháp,
        // hàng đợi duyệt.
        await this.meetingProcessingService.requestAnalysis(
            meeting,
            version._id,
        );

        this.logger.log(
            `Chốt transcript trực tiếp cho ${meeting._id}, phiên bản ${version._id}`,
        );
        return { meetingId: meeting._id, transcriptVersionId: version._id };
    }

    private async getOrCreateLiveVersion(meeting: Meeting) {
        const versions = await this.transcriptVersionService.getMany(
            null,
            { meetingId: meeting._id },
            {} as any,
        );
        const current = versions.find(
            (v) =>
                v.isCurrent && v.source === TranscriptVersionSource.LIVE_CAPTION,
        );
        if (current) {
            return current;
        }

        for (const old of versions.filter((v) => v.isCurrent)) {
            await this.transcriptVersionService.updateById(null, old._id, {
                isCurrent: false,
            });
        }

        return this.transcriptVersionService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            versionNo: versions.length + 1,
            source: TranscriptVersionSource.LIVE_CAPTION,
            isCurrent: true,
        });
    }

    private async upsertAlias(
        meeting: Meeting,
        transcriptVersionId: string,
        speakerLabel: string,
        displayName: string,
    ) {
        const existing = await this.speakerAliasService.getOne(null, {
            transcriptVersionId,
            speakerLabel,
        });
        if (existing) {
            return existing;
        }
        // userId để trống: tên trên Google Meet chưa map sang tài khoản
        // MeetingMind. Việc map là thao tác có chủ đích của người dùng.
        return this.speakerAliasService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            transcriptVersionId,
            speakerLabel,
            displayName,
        });
    }
}
