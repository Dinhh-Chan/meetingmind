import { ApiError } from "@config/exception/api-error";
import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { ProcessingStatus as MeetingProcessingStatus } from "@module/meeting/common/constant";
import {
    EventType,
    TranscriptionCompletedPayload,
    AnalysisCompletedPayload,
} from "@module/messaging/common/constant";
import { OutboxService } from "@module/messaging/services/outbox.service";
import { MinutesVersionStatus } from "@module/minutes-version/common/constant";
import { MinutesVersionService } from "@module/minutes-version/services/minutes-version.service";
import {
    ProcessingJobStatus,
    ProcessingJobType,
} from "@module/processing-job/common/constant";
import { ProcessingJobService } from "@module/processing-job/services/processing-job.service";
import { ReviewBatchStatus } from "@module/review-batch/common/constant";
import { ReviewBatchService } from "@module/review-batch/services/review-batch.service";
import {
    ReviewItemStatus,
    ReviewItemType,
} from "@module/review-item/common/constant";
import { ReviewItemService } from "@module/review-item/services/review-item.service";
import { SpeakerIdentityStatus } from "@module/transcript-segment/common/constant";
import { TranscriptSegmentService } from "@module/transcript-segment/services/transcript-segment.service";
import { TranscriptVersionSource } from "@module/transcript-version/common/constant";
import { TranscriptVersionService } from "@module/transcript-version/services/transcript-version.service";
import { Injectable, Logger } from "@nestjs/common";

export interface StartTranscriptionDto {
    meetingId: string;
    bucket: string;
    objectKey: string;
    fileId?: string;
}

/**
 * Điều phối luồng xử lý một cuộc họp.
 *
 * Core ra lệnh và ghi kết quả; AI chỉ tính toán rồi trả về. AI không ghi thẳng
 * vào bảng nghiệp vụ nào — xem ARCHITECTURE.md mục 3.4.
 */
@Injectable()
export class MeetingProcessingService {
    private readonly logger = new Logger(MeetingProcessingService.name);

    constructor(
        private readonly meetingService: MeetingService,
        private readonly processingJobService: ProcessingJobService,
        private readonly transcriptVersionService: TranscriptVersionService,
        private readonly transcriptSegmentService: TranscriptSegmentService,
        private readonly meetingMinutesService: MeetingMinutesService,
        private readonly minutesVersionService: MinutesVersionService,
        private readonly reviewBatchService: ReviewBatchService,
        private readonly reviewItemService: ReviewItemService,
        private readonly outboxService: OutboxService,
    ) {}

    /** Bước 5 của luồng: tạo job phiên âm và phát lệnh cho AI. */
    async startTranscription(dto: StartTranscriptionDto) {
        const meeting = await this.meetingService.getOne(null, {
            _id: dto.meetingId,
        });
        if (!meeting) {
            throw ApiError.NotFound("error-meeting-not-found");
        }

        // Khóa chống chạy trùng: cùng file thì chỉ phiên âm một lần.
        const idempotencyKey = `${dto.meetingId}:transcribe:${dto.objectKey}`;
        const existing = await this.processingJobService.getOne(null, {
            idempotencyKey,
        });
        if (existing) {
            this.logger.log(`Job phiên âm đã tồn tại: ${existing._id}`);
            return existing;
        }

        const job = await this.processingJobService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            type: ProcessingJobType.TRANSCRIBE,
            status: ProcessingJobStatus.QUEUED,
            idempotencyKey,
            inputVersion: dto.objectKey,
            payload: { bucket: dto.bucket, objectKey: dto.objectKey },
            retryCount: 0,
        });

        await this.outboxService.emit({
            aggregateType: "meeting",
            aggregateId: meeting._id,
            eventType: EventType.TRANSCRIPTION_REQUESTED,
            workspaceId: meeting.workspaceId,
            payload: {
                jobId: job._id,
                meetingId: meeting._id,
                fileId: dto.fileId,
                bucket: dto.bucket,
                objectKey: dto.objectKey,
                language: meeting.language,
            },
        });

        await this.meetingService.updateById(null, meeting._id, {
            processingStatus: MeetingProcessingStatus.TRANSCRIBING,
        });

        return job;
    }

    /** Bước 7: nhận transcript từ AI, ghi thành phiên bản chính thức. */
    async onTranscriptionCompleted(payload: TranscriptionCompletedPayload) {
        const meeting = await this.meetingService.getOne(null, {
            _id: payload.meetingId,
        });
        if (!meeting) {
            this.logger.warn(`Không thấy cuộc họp ${payload.meetingId}`);
            return;
        }

        // Sửa transcript hoặc chạy lại AI đều tạo phiên bản mới, không ghi đè.
        const previous = await this.transcriptVersionService.getMany(
            null,
            { meetingId: meeting._id },
            {} as any,
        );
        const versionNo = previous.length + 1;

        // Chỉ một phiên bản được đánh dấu đang dùng.
        for (const old of previous.filter((v) => v.isCurrent)) {
            await this.transcriptVersionService.updateById(null, old._id, {
                isCurrent: false,
            });
        }

        const version = await this.transcriptVersionService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            versionNo,
            source: TranscriptVersionSource.STT,
            aiRunId: payload.runId,
            isCurrent: true,
        });

        let sequence = 0;
        for (const segment of payload.segments) {
            sequence += 1;
            await this.transcriptSegmentService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
                transcriptVersionId: version._id,
                speakerLabel: segment.speakerLabel,
                // STT chỉ tách được giọng, không biết đó là ai.
                identityStatus: SpeakerIdentityStatus.UNKNOWN,
                startMs: segment.startMs,
                endMs: segment.endMs,
                text: segment.text,
                rawText: segment.text,
                confidence: segment.confidence,
                sequence,
            });
        }

        await this.processingJobService.updateOne(
            null,
            { _id: payload.jobId },
            {
                status: ProcessingJobStatus.SUCCEEDED,
                finishedAt: new Date(),
                result: { transcriptVersionId: version._id, segments: sequence },
            },
        );

        this.logger.log(
            `Transcript v${versionNo} cho ${meeting._id}: ${sequence} đoạn`,
        );

        await this.startAnalysis(meeting, version._id);
        return version;
    }

    /** Bước 8: xin AI tóm tắt và trích xuất công việc. */
    private async startAnalysis(
        meeting: { _id: string; workspaceId: string; language: string },
        transcriptVersionId: string,
    ) {
        const idempotencyKey = `${meeting._id}:analyze:${transcriptVersionId}`;
        const existing = await this.processingJobService.getOne(null, {
            idempotencyKey,
        });
        if (existing) {
            return existing;
        }

        const job = await this.processingJobService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            type: ProcessingJobType.SUMMARIZE,
            status: ProcessingJobStatus.QUEUED,
            idempotencyKey,
            inputVersion: transcriptVersionId,
            payload: { transcriptVersionId },
            retryCount: 0,
        });

        await this.outboxService.emit({
            aggregateType: "meeting",
            aggregateId: meeting._id,
            eventType: EventType.ANALYSIS_REQUESTED,
            workspaceId: meeting.workspaceId,
            payload: {
                jobId: job._id,
                meetingId: meeting._id,
                transcriptVersionId,
                language: meeting.language,
            },
        });

        await this.meetingService.updateById(null, meeting._id, {
            processingStatus: MeetingProcessingStatus.SUMMARIZING,
        });

        return job;
    }

    /** Bước 9: biến kết quả AI thành biên bản nháp và hàng đợi duyệt. */
    async onAnalysisCompleted(payload: AnalysisCompletedPayload) {
        const meeting = await this.meetingService.getOne(null, {
            _id: payload.meetingId,
        });
        if (!meeting) {
            this.logger.warn(`Không thấy cuộc họp ${payload.meetingId}`);
            return;
        }

        let minutes = await this.meetingMinutesService.getOne(null, {
            meetingId: meeting._id,
        });
        if (!minutes) {
            minutes = await this.meetingMinutesService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
            });
        }

        const previousVersions = await this.minutesVersionService.getMany(
            null,
            { meetingMinutesId: minutes._id },
            {} as any,
        );

        const minutesVersion = await this.minutesVersionService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingMinutesId: minutes._id,
            versionNo: previousVersions.length + 1,
            summary: payload.summary,
            openIssues: (payload.openIssues ?? []).map((issue) => ({
                title: issue,
            })),
            // Chạy lại AI tạo bản nháp mới, không đụng bản đã duyệt.
            status: MinutesVersionStatus.DRAFT,
            sourceTranscriptVersionId: payload.transcriptVersionId,
            aiRunId: payload.runId,
        });

        await this.meetingMinutesService.updateById(null, minutes._id, {
            currentVersionId: minutesVersion._id,
        });

        // Đề xuất của AI vào hàng đợi duyệt, chưa phải dữ liệu chính thức.
        const batch = await this.reviewBatchService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            status: ReviewBatchStatus.PENDING,
            sourceTranscriptVersionId: payload.transcriptVersionId,
            aiRunId: payload.runId,
        });

        const proposals = [
            ...(payload.actionItems ?? []).map((item) => ({
                type: ReviewItemType.ACTION_ITEM,
                payload: item as unknown as Record<string, any>,
            })),
            ...(payload.decisions ?? []).map((item) => ({
                type: ReviewItemType.DECISION,
                payload: item as unknown as Record<string, any>,
            })),
            ...(payload.openIssues ?? []).map((issue) => ({
                type: ReviewItemType.OPEN_ISSUE,
                payload: { title: issue } as Record<string, any>,
            })),
        ];

        for (const proposal of proposals) {
            await this.reviewItemService.create(null, {
                workspaceId: meeting.workspaceId,
                reviewBatchId: batch._id,
                type: proposal.type,
                // Giữ bản gốc để đối chiếu với nội dung người dùng sửa.
                originalPayload: proposal.payload,
                payload: proposal.payload,
                status: ReviewItemStatus.PENDING,
            });
        }

        await this.processingJobService.updateOne(
            null,
            { _id: payload.jobId },
            {
                status: ProcessingJobStatus.SUCCEEDED,
                finishedAt: new Date(),
                result: {
                    minutesVersionId: minutesVersion._id,
                    reviewBatchId: batch._id,
                    proposals: proposals.length,
                },
            },
        );

        await this.meetingService.updateById(null, meeting._id, {
            processingStatus: MeetingProcessingStatus.DONE,
        });

        this.logger.log(
            `Biên bản nháp v${minutesVersion.versionNo} + ${proposals.length} đề xuất cho ${meeting._id}`,
        );
        return { minutesVersion, batch };
    }

    async onJobFailed(payload: { jobId: string; meetingId: string; error: string }) {
        await this.processingJobService.updateOne(
            null,
            { _id: payload.jobId },
            {
                status: ProcessingJobStatus.FAILED,
                error: payload.error,
                finishedAt: new Date(),
            },
        );
        await this.meetingService.updateById(null, payload.meetingId, {
            processingStatus: MeetingProcessingStatus.FAILED,
        });
        this.logger.error(`Job ${payload.jobId} lỗi: ${payload.error}`);
    }
}
