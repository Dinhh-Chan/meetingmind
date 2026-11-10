import { ApiError } from "@config/exception/api-error";
import {
    KnowledgeIndexService,
    KnowledgeMeeting,
} from "@module/knowledge/services/knowledge-index.service";
import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { MeetingService } from "@module/meeting/services/meeting.service";
import {
    MeetingStatus,
    ProcessingStatus as MeetingProcessingStatus,
} from "@module/meeting/common/constant";
import {
    EventType,
    TranscriptionCompletedPayload,
    AnalysisCompletedPayload,
    AnalysisSegment,
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
import { MeetingParticipantService } from "@module/meeting-participant/services/meeting-participant.service";
import { MeetingRecordService } from "@module/meeting-record/meeting-record.service";
import { SpeakerAliasService } from "@module/speaker-alias/services/speaker-alias.service";
import { UserService } from "@module/user/service/user.service";
import { VoiceProfileService } from "@module/voice-profile/services/voice-profile.service";
import { SpeakerIdentityStatus } from "@module/transcript-segment/common/constant";
import { TranscriptSegmentService } from "@module/transcript-segment/services/transcript-segment.service";
import { TranscriptVersionSource } from "@module/transcript-version/common/constant";
import { TranscriptVersionService } from "@module/transcript-version/services/transcript-version.service";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Phụ đề Google Meet ghi chính người đang xem là "You"/"Bạn" (theo ngôn ngữ
 * giao diện Meet); extension gửi nguyên văn nhãn đó. Cùng tập với
 * `SELF_LABELS` ở giao diện (lib/api/adapters.ts).
 */
const SELF_SPEAKER_LABELS = new Set(["you", "bạn"]);

const isSelfLabel = (label?: string | null) =>
    !!label &&
    SELF_SPEAKER_LABELS.has(label.normalize("NFC").trim().toLowerCase());

export interface StartTranscriptionDto {
    meetingId: string;
    bucket: string;
    objectKey: string;
    fileId?: string;
    /** Người ghi âm: transcript và biên bản nháp từ bản ghi này thuộc về người đó. */
    recordedById?: string;
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
        private readonly speakerAliasService: SpeakerAliasService,
        private readonly meetingParticipantService: MeetingParticipantService,
        private readonly meetingRecordService: MeetingRecordService,
        private readonly voiceProfileService: VoiceProfileService,
        private readonly userService: UserService,
        private readonly outboxService: OutboxService,
        private readonly knowledgeIndexService: KnowledgeIndexService,
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
            payload: {
                bucket: dto.bucket,
                objectKey: dto.objectKey,
                recordedById: dto.recordedById ?? meeting.createdById,
            },
            retryCount: 0,
        });

        // Vân giọng của người tham dự đã đăng ký: AI dùng để gợi ý ai là "Người nói N".
        const participants = await this.meetingParticipantService.getMany(null, {
            meetingId: meeting._id,
        });
        const voiceProfiles = await this.voiceProfileService.profilesFor([
            ...new Set(participants.map((p) => p.userId).filter(Boolean)),
        ]);

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
                voiceProfiles,
            },
        });

        await this.meetingService.updateById(null, meeting._id, {
            processingStatus: MeetingProcessingStatus.TRANSCRIBING,
        });

        return job;
    }

    /**
     * Kết quả ghép vân giọng của AI, chỉ giữ người thật sự tham dự cuộc họp
     * (AI chỉ nhận vân giọng của họ, kiểm lại cho chắc).
     */
    private async voiceMatches(
        meetingId: string,
        speakerMatches: TranscriptionCompletedPayload["speakerMatches"],
    ) {
        const result = new Map<string, { userId: string; score: number; displayName: string }>();
        const entries = Object.entries(speakerMatches ?? {});
        if (!entries.length) return result;
        const participants = await this.meetingParticipantService.getMany(null, { meetingId });
        const allowed = new Set(participants.map((p) => p.userId).filter(Boolean));
        const users = await this.userService.getMany(
            null,
            { _id: { $in: entries.map(([, m]) => m.userId) } },
            { enableDataPartition: false },
        );
        const nameOf = new Map(users.map((u) => [u._id, u.fullname || u.username]));
        for (const [label, m] of entries) {
            if (!allowed.has(m.userId) || !nameOf.has(m.userId)) continue;
            result.set(label, { userId: m.userId, score: m.score, displayName: nameOf.get(m.userId) });
        }
        this.logger.log(`Gợi ý người nói theo giọng: ${result.size}/${entries.length} nhãn`);
        return result;
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

        const job = await this.processingJobService.getOne(null, {
            _id: payload.jobId,
        });
        const recordedById: string =
            job?.payload?.recordedById ?? meeting.createdById;

        // Sửa transcript hoặc chạy lại AI đều tạo phiên bản mới, không ghi đè.
        const previous = await this.transcriptVersionService.getMany(
            null,
            { meetingId: meeting._id },
            {} as any,
        );
        const versionNo = previous.length + 1;

        // Mỗi người ghi có một phiên bản đang dùng; bản ghi của người khác giữ nguyên.
        for (const old of previous.filter(
            (v) =>
                v.isCurrent &&
                MeetingRecordService.recorderOf(v, meeting) === recordedById,
        )) {
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
            recordedById,
            isCurrent: true,
        });

        const matches = await this.voiceMatches(meeting._id, payload.speakerMatches);

        let sequence = 0;
        for (const segment of payload.segments) {
            sequence += 1;
            const match = matches.get(segment.speakerLabel);
            await this.transcriptSegmentService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
                transcriptVersionId: version._id,
                speakerLabel: segment.speakerLabel,
                // STT chỉ tách được giọng; khớp vân giọng đã đăng ký thì là gợi ý,
                // người dùng xác nhận hoặc đổi ở tab Transcript.
                speakerUserId: match?.userId,
                identityStatus: match ? SpeakerIdentityStatus.SUGGESTED : SpeakerIdentityStatus.UNKNOWN,
                identityScore: match?.score,
                startMs: segment.startMs,
                endMs: segment.endMs,
                text: segment.text,
                rawText: segment.text,
                confidence: segment.confidence,
                language: segment.language,
                isOverlapping: segment.isOverlapping ?? false,
                sequence,
            });
        }

        // Tên gợi ý theo giọng đi kèm transcript sang AI phân tích (biên bản ghi
        // tên người thay vì "Người nói N"); chưa ai xác nhận nên confirmedById trống.
        for (const [speakerLabel, match] of matches) {
            await this.speakerAliasService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
                transcriptVersionId: version._id,
                speakerLabel,
                displayName: match.displayName,
                userId: match.userId,
            });
        }

        await this.processingJobService.updateOne(
            null,
            { _id: payload.jobId },
            {
                status: ProcessingJobStatus.SUCCEEDED,
                finishedAt: new Date(),
                result: {
                    transcriptVersionId: version._id,
                    segments: sequence,
                    languages: payload.languages,
                },
            },
        );

        // Ngôn ngữ cuộc họp mặc định "vi" lúc tạo; sau khi nghe thật thì theo
        // ngôn ngữ nói nhiều nhất, để bước phân tích viết biên bản đúng tiếng.
        if (payload.language && payload.language !== meeting.language) {
            await this.meetingService.updateById(null, meeting._id, {
                language: payload.language,
            });
            meeting.language = payload.language;
        }

        // Đã có bản ghi tức là cuộc họp đã diễn ra: tệp tải lên của buổi họp
        // trực tiếp không đi qua bước bắt đầu/kết thúc nên vẫn đang "đã lên lịch".
        if (meeting.status === MeetingStatus.SCHEDULED) {
            await this.meetingService.updateById(null, meeting._id, {
                status: MeetingStatus.ENDED,
                actualEndAt: new Date(),
            });
        }

        this.logger.log(
            `Transcript v${versionNo} cho ${meeting._id}: ${sequence} đoạn`,
        );

        await this.requestAnalysis(meeting, version._id);
        await this.indexTranscript(meeting, version._id);
        return version;
    }

    /**
     * Xin ai-worker lập chỉ mục transcript hiện tại cho hỏi đáp, cùng cách
     * dựng đoạn với lệnh phân tích (tên người nói đã gán thay cho nhãn).
     *
     * Là việc phụ: lỗi chỉ ghi log, không làm hỏng luồng phiên âm/duyệt đang
     * chạy — thiếu thì bù bằng POST /workflow/knowledge/reindex.
     */
    async indexTranscript(
        meeting: KnowledgeMeeting & { createdById?: string },
        transcriptVersionId: string,
    ) {
        try {
            const version = await this.transcriptVersionService.getById(
                null,
                transcriptVersionId,
            );
            // Bản ghi riêng của một người chưa được duyệt thì người khác không
            // xem được, nên cũng không vào kho hỏi đáp chung.
            if (
                !version ||
                !(await this.meetingRecordService.isPublicTranscript(
                    { _id: meeting._id, createdById: meeting.createdById },
                    version,
                ))
            ) {
                return false;
            }
            return await this.knowledgeIndexService.indexTranscript(
                meeting,
                { _id: transcriptVersionId, versionNo: version?.versionNo },
                await this.analysisSegments(transcriptVersionId),
            );
        } catch (err) {
            this.logger.warn(
                `Không xin lập chỉ mục transcript ${transcriptVersionId}: ${err.message}`,
            );
            return false;
        }
    }

    /**
     * Bước 8: xin AI tóm tắt và trích xuất công việc.
     * Công khai vì đường transcript trực tiếp (extension) cũng dùng lại.
     */
    async requestAnalysis(
        meeting: {
            _id: string;
            workspaceId: string;
            language: string;
            createdById?: string;
        },
        transcriptVersionId: string,
        options: { rerun?: boolean } = {},
    ) {
        let idempotencyKey = `${meeting._id}:analyze:${transcriptVersionId}`;
        if (options.rerun) {
            // Người dùng chủ động phân tích lại (ví dụ sau khi gán tên người nói):
            // mỗi lần là một job mới, còn tin trùng của cùng một lần vẫn bị chặn.
            const previous = await this.processingJobService.getMany(
                null,
                { meetingId: meeting._id, type: ProcessingJobType.SUMMARIZE },
                {} as any,
            );
            idempotencyKey += `:r${previous.length}`;
        }
        const existing = await this.processingJobService.getOne(null, {
            idempotencyKey,
        });
        if (existing) {
            return existing;
        }

        const transcript = await this.transcriptVersionService.getById(
            null,
            transcriptVersionId,
        );
        const job = await this.processingJobService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            type: ProcessingJobType.SUMMARIZE,
            status: ProcessingJobStatus.QUEUED,
            idempotencyKey,
            inputVersion: transcriptVersionId,
            payload: {
                transcriptVersionId,
                recordedById: transcript
                    ? MeetingRecordService.recorderOf(transcript, meeting)
                    : undefined,
            },
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
                segments: await this.analysisSegments(transcriptVersionId),
            },
        });

        await this.meetingService.updateById(null, meeting._id, {
            processingStatus: MeetingProcessingStatus.SUMMARIZING,
        });

        return job;
    }

    /**
     * Transcript gửi kèm lệnh phân tích, theo đúng thứ tự nói.
     *
     * Nhãn người nói đã được đặt tên thì gửi tên: AI ghi người thực hiện theo
     * tên xuất hiện trong transcript (assigneeHint). Nhãn "You"/"Bạn" của phụ
     * đề Meet chưa ai đặt tên thì là người tạo cuộc họp (người cài extension) —
     * để nguyên thì AI giao việc cho "You" và hỏi đáp trả lời "Bạn nói…".
     */
    private async analysisSegments(
        transcriptVersionId: string,
    ): Promise<AnalysisSegment[]> {
        const [segments, aliases] = await Promise.all([
            this.transcriptSegmentService.getMany(null, { transcriptVersionId }),
            this.speakerAliasService.getMany(null, { transcriptVersionId }),
        ]);
        const names = new Map(
            aliases
                .filter((a) => a.displayName && a.displayName !== a.speakerLabel)
                .map((a) => [a.speakerLabel, a.displayName]),
        );
        const self = segments.find(
            (s) => isSelfLabel(s.speakerLabel) && !names.has(s.speakerLabel),
        );
        const selfName = self
            ? await this.creatorName(self.meetingId)
            : undefined;
        return [...segments]
            .sort((a, b) => a.sequence - b.sequence)
            .map((segment) => ({
                sequence: segment.sequence,
                speaker:
                    names.get(segment.speakerLabel) ??
                    (selfName && isSelfLabel(segment.speakerLabel)
                        ? selfName
                        : segment.speakerLabel),
                text: segment.text,
                startMs: segment.startMs,
                endMs: segment.endMs,
                language: segment.language ?? undefined,
            }));
    }

    /** Tên hiển thị của người tạo cuộc họp (fullname, không có thì username). */
    private async creatorName(meetingId: string) {
        const meeting = await this.meetingService.getOne(null, {
            _id: meetingId,
        });
        if (!meeting?.createdById) return undefined;
        const names = await this.knowledgeIndexService.userNames([
            meeting.createdById,
        ]);
        return names.get(meeting.createdById);
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

        const source = await this.transcriptVersionService.getById(
            null,
            payload.transcriptVersionId,
        );
        const minutesVersion = await this.minutesVersionService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingMinutesId: minutes._id,
            versionNo: previousVersions.length + 1,
            recordedById: source
                ? MeetingRecordService.recorderOf(source, meeting)
                : meeting.createdById,
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
