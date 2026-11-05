import { ApiError } from "@config/exception/api-error";
import { ActionItemService } from "@module/action-item/services/action-item.service";
import { DecisionService } from "@module/decision/services/decision.service";
import {
    KnowledgeAiClient,
    KnowledgeAskResponse,
    KnowledgeHistoryTurn,
} from "@module/knowledge/services/knowledge-ai.client";
import {
    KnowledgeIndexService,
    meetingDateOf,
    reviewExtraOf,
} from "@module/knowledge/services/knowledge-index.service";
import {
    MediaFileKind,
    MediaFileStatus,
} from "@module/media-file/common/constant";
import { MediaFile } from "@module/media-file/entities/media-file.entity";
import { MediaFileService } from "@module/media-file/services/media-file.service";
import {
    decodeUploadName,
    MediaFileUploadService,
} from "@module/media-file/services/media-file-upload.service";
import { MeetingProcessingService } from "@module/meeting-processing/services/meeting-processing.service";
import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { MinioService } from "@module/minio/minio.service";
import { MinutesVersionStatus } from "@module/minutes-version/common/constant";
import { MinutesVersionService } from "@module/minutes-version/services/minutes-version.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { ReviewItemService } from "@module/review-item/services/review-item.service";
import { TranscriptVersionService } from "@module/transcript-version/services/transcript-version.service";
import { WorkspaceMemberRole } from "@module/workspace-member/common/constant";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Quyền đọc trọn nội dung đưa vào kho: transcript, biên bản đã duyệt, task.
 * Kho trộn mọi loại nguồn của một cuộc họp nên phải có đủ cả bộ mới được hỏi.
 */
const KNOWLEDGE_READ_PERMISSIONS = [
    Permission.MEETING_VIEW,
    Permission.TRANSCRIPT_VIEW,
    Permission.MINUTES_VIEW_APPROVED,
];

/**
 * Thêm/xoá tài liệu: dùng quyền sửa biên bản nháp. Tài liệu vào kho mà mọi
 * người xem cuộc họp đều hỏi được, nên ngang với sửa nội dung chính thức —
 * không phải ghi chú (ai xem cũng thêm được, nhưng chỉ là ý cá nhân). Quyền
 * này gồm PM, người sửa/quản lý cuộc họp độc lập và người tạo cuộc họp.
 */
const DOCUMENT_EDIT_PERMISSION = Permission.MINUTES_UPDATE_DRAFT;

const MAX_HISTORY_TURNS = 6;

/** Cùng câu với giao diện bản demo (lib/data/knowledge.ts). */
const INSUFFICIENT_ANSWER =
    "Chưa đủ thông tin trong các cuộc họp bạn có quyền xem.";

export interface AskInput {
    workspaceId: string;
    question: string;
    history?: KnowledgeHistoryTurn[];
}

/**
 * Hỏi đáp tri thức phía Core: quyết định người hỏi được tìm trong cuộc họp
 * nào, rồi mới nhờ ai-service. AI không biết gì về quyền — mọi lọc nằm ở đây
 * (ARCHITECTURE.md mục 6), kể cả kiểm lại nguồn AI trả về.
 */
@Injectable()
export class KnowledgeService {
    private readonly logger = new Logger(KnowledgeService.name);

    constructor(
        private readonly permissionService: PermissionService,
        private readonly meetingService: MeetingService,
        private readonly meetingMinutesService: MeetingMinutesService,
        private readonly minutesVersionService: MinutesVersionService,
        private readonly transcriptVersionService: TranscriptVersionService,
        private readonly decisionService: DecisionService,
        private readonly actionItemService: ActionItemService,
        private readonly reviewItemService: ReviewItemService,
        private readonly mediaFileService: MediaFileService,
        private readonly mediaFileUploadService: MediaFileUploadService,
        private readonly minioService: MinioService,
        private readonly meetingProcessingService: MeetingProcessingService,
        private readonly knowledgeIndexService: KnowledgeIndexService,
        private readonly knowledgeAiClient: KnowledgeAiClient,
    ) {}

    /* ------------------------------------------------------- hỏi đáp */

    /**
     * Cuộc họp người này được hỏi tới: cùng luật lọc với danh sách cuộc họp
     * (`/me/meetings` → `PermissionService.filterMeetings`), thêm quyền đọc
     * transcript và biên bản. Cuộc họp riêng tư/giới hạn không được mời thì
     * không lọt vào.
     */
    private async readableMeetings(userId: string, workspaceId: string) {
        await this.permissionService.assert(
            userId,
            workspaceId,
            Permission.CHAT_QUERY,
        );
        const candidates = await this.meetingService.getMany(null, {
            workspaceId,
            deletedAt: null,
        });
        return this.permissionService.filterMeetings(
            userId,
            candidates,
            KNOWLEDGE_READ_PERMISSIONS,
        );
    }

    async ask(userId: string, input: AskInput) {
        const question = input.question?.trim();
        if (!question) throw ApiError.BadRequest("error-question-empty");

        const meetings = await this.readableMeetings(userId, input.workspaceId);
        // Không có cuộc họp nào để tìm: khỏi gọi AI, trả lời ngay.
        if (!meetings.length) {
            return {
                answer: INSUFFICIENT_ANSWER,
                insufficient: true,
                model: "",
                citations: [],
            };
        }

        const history = (input.history ?? [])
            .filter((t) => t?.content?.trim())
            .slice(-MAX_HISTORY_TURNS)
            .map((t) => ({ role: t.role, content: t.content.trim() }));
        const res = await this.knowledgeAiClient.ask({
            workspaceId: input.workspaceId,
            question,
            meetingIds: meetings.map((m) => m._id),
            history,
        });
        return this.checkCitations(userId, res, meetings);
    }

    /**
     * AI chỉ được tìm trong cuộc họp đã lọc, nên nguồn ngoài danh sách là dấu
     * hiệu lỗi phía AI. Khi đó cả câu trả lời có thể đã dùng nội dung người hỏi
     * không được xem — bỏ hết thay vì chỉ bỏ nguồn đó.
     */
    private checkCitations(
        userId: string,
        res: KnowledgeAskResponse,
        meetings: Meeting[],
    ) {
        const meetingOf = new Map(meetings.map((m) => [m._id, m]));
        const foreign = res.citations.filter(
            (c) => !meetingOf.has(c?.meetingId),
        );
        if (foreign.length) {
            this.logger.warn(
                `AI trích ${foreign.length} nguồn ngoài quyền của ${userId}, bỏ câu trả lời`,
            );
            return {
                answer: INSUFFICIENT_ANSWER,
                insufficient: true,
                model: res.model,
                citations: [],
            };
        }
        return {
            answer: res.answer,
            list: res.list?.length ? res.list : undefined,
            insufficient: res.insufficient,
            model: res.model,
            citations: res.citations.map((c) => {
                const meeting = meetingOf.get(c.meetingId);
                return {
                    ...c,
                    // Tên hiện tại trong Core: cuộc họp có thể đã đổi tên sau khi lập chỉ mục.
                    meetingTitle: meeting.title,
                    meetingDate: meetingDateOf(meeting),
                    projectId: meeting.projectId ?? null,
                };
            }),
        };
    }

    /** Nguồn đã lập chỉ mục của các cuộc họp người này được hỏi. */
    async sources(userId: string, workspaceId: string) {
        const meetings = await this.readableMeetings(userId, workspaceId);
        if (!meetings.length) return [];
        const meetingOf = new Map(meetings.map((m) => [m._id, m]));
        const sources = await this.knowledgeAiClient.sources({
            workspaceId,
            meetingIds: meetings.map((m) => m._id),
        });
        return sources
            .filter((s) => meetingOf.has(s?.meetingId))
            .map((s) => {
                const meeting = meetingOf.get(s.meetingId);
                return {
                    ...s,
                    meetingTitle: meeting.title,
                    meetingDate: meetingDateOf(meeting),
                    projectId: meeting.projectId ?? null,
                };
            });
    }

    /* ------------------------------------------------------- lập lại chỉ mục */

    /**
     * Phát lại lệnh lập chỉ mục cho mọi nội dung chính thức của workspace —
     * dùng lần đầu bật tính năng, hoặc khi kho phía AI bị xoá. Chỉ Owner/Admin:
     * thao tác chạm mọi cuộc họp, kể cả cuộc họp họ không tham dự.
     */
    async reindex(userId: string, workspaceId: string) {
        const role = await this.permissionService.getWorkspaceRole(
            userId,
            workspaceId,
        );
        if (
            role !== WorkspaceMemberRole.OWNER &&
            role !== WorkspaceMemberRole.ADMIN
        ) {
            throw ApiError.Forbidden("error-forbidden");
        }
        const meetings = await this.meetingService.getMany(null, {
            workspaceId,
            deletedAt: null,
        });
        const counts = {
            meetings: meetings.length,
            transcript: 0,
            minutes: 0,
            decision: 0,
            action_item: 0,
            document: 0,
        };
        if (!meetings.length) return counts;
        const meetingOf = new Map(meetings.map((m) => [m._id, m]));
        const ids = meetings.map((m) => m._id);

        const versions = await this.transcriptVersionService.getMany(null, {
            meetingId: { $in: ids },
            isCurrent: true,
        });
        for (const version of versions) {
            const meeting = meetingOf.get(version.meetingId);
            if (
                meeting &&
                (await this.meetingProcessingService.indexTranscript(
                    meeting,
                    version._id,
                ))
            ) {
                counts.transcript += 1;
            }
        }

        // Bản đã duyệt gần nhất, kể cả khi đang có bản nháp mới chép từ nó.
        const minutesList = await this.meetingMinutesService.getMany(null, {
            meetingId: { $in: ids },
        });
        const approvedIds = minutesList
            .map((m) => m.approvedVersionId)
            .filter(Boolean);
        const approved = approvedIds.length
            ? await this.minutesVersionService.getMany(null, {
                  _id: { $in: approvedIds },
                  status: MinutesVersionStatus.APPROVED,
              })
            : [];
        const meetingOfMinutes = new Map(
            minutesList.map((m) => [m._id, m.meetingId]),
        );
        for (const version of approved) {
            const meeting = meetingOf.get(
                meetingOfMinutes.get(version.meetingMinutesId),
            );
            if (
                meeting &&
                (await this.knowledgeIndexService.indexMinutes(
                    meeting,
                    version,
                ))
            ) {
                counts.minutes += 1;
            }
        }

        const [decisions, tasks] = await Promise.all([
            this.decisionService.getMany(null, {
                workspaceId,
                deletedAt: null,
            }),
            this.actionItemService.getMany(null, {
                workspaceId,
                deletedAt: null,
            }),
        ]);
        const reviewIds = [...decisions, ...tasks]
            .map((r) => r.reviewItemId)
            .filter(Boolean);
        const reviews = reviewIds.length
            ? await this.reviewItemService.getMany(null, {
                  _id: { $in: reviewIds },
              })
            : [];
        const payloadOf = new Map(reviews.map((r) => [r._id, r.payload]));
        for (const decision of decisions) {
            const meeting = meetingOf.get(decision.meetingId);
            if (!meeting) continue;
            await this.knowledgeIndexService.indexDecision(
                meeting,
                decision,
                reviewExtraOf(payloadOf.get(decision.reviewItemId)),
            );
            counts.decision += 1;
        }
        const names = await this.knowledgeIndexService.userNames(
            tasks.map((t) => t.assigneeId),
        );
        for (const task of tasks) {
            const meeting = meetingOf.get(task.meetingId);
            if (!meeting) continue;
            await this.knowledgeIndexService.indexActionItem(meeting, task, {
                ...reviewExtraOf(payloadOf.get(task.reviewItemId)),
                assigneeName: names.get(task.assigneeId),
            });
            counts.action_item += 1;
        }

        const documents = await this.mediaFileService.getMany(null, {
            workspaceId,
            kind: MediaFileKind.DOCUMENT,
            status: MediaFileStatus.READY,
        });
        for (const file of documents) {
            const meeting = meetingOf.get(file.meetingId);
            if (!meeting) continue;
            await this.knowledgeIndexService.indexDocument(meeting, file);
            counts.document += 1;
        }

        this.logger.log(
            `Lập lại chỉ mục workspace ${workspaceId}: ${JSON.stringify(counts)}`,
        );
        return counts;
    }

    /* ------------------------------------------------------- tài liệu */

    private async meetingFor(
        userId: string,
        meetingId: string,
        permission: Permission,
    ) {
        const meeting = await this.meetingService.getOne(null, {
            _id: meetingId,
            deletedAt: null,
        });
        if (!meeting) throw ApiError.NotFound("error-meeting-not-found");
        await this.permissionService.assertOnMeeting(
            userId,
            meeting,
            permission,
        );
        return meeting;
    }

    async uploadDocument(
        userId: string,
        meetingId: string,
        file?: Express.Multer.File,
    ) {
        const meeting = await this.meetingFor(
            userId,
            meetingId,
            DOCUMENT_EDIT_PERMISSION,
        );
        if (!file?.buffer?.length)
            throw ApiError.BadRequest("error-document-invalid");
        const media = await this.mediaFileUploadService.upload({
            workspaceId: meeting.workspaceId,
            meetingId: meeting._id,
            kind: MediaFileKind.DOCUMENT,
            originalName: decodeUploadName(file.originalname),
            mimetype: file.mimetype,
            buffer: file.buffer,
            uploadedById: userId,
        });
        // Tệp đã lưu thì trả về được; lỗi phát lệnh chỉ ghi log, reindex bù sau.
        try {
            await this.knowledgeIndexService.indexDocument(meeting, media);
        } catch (err) {
            this.logger.warn(
                `Không xin lập chỉ mục tài liệu ${media._id}: ${err.message}`,
            );
        }
        return toDocument(media);
    }

    async listDocuments(userId: string, meetingId: string) {
        await this.meetingFor(userId, meetingId, Permission.MEETING_VIEW);
        const files = await this.mediaFileService.getMany(null, {
            meetingId,
            kind: MediaFileKind.DOCUMENT,
            status: MediaFileStatus.READY,
        });
        return files
            .map(toDocument)
            .sort(
                (a, b) =>
                    new Date(b.createdAt ?? 0).getTime() -
                    new Date(a.createdAt ?? 0).getTime(),
            );
    }

    /** Xoá mềm bản ghi, gỡ object trên MinIO và xin AI bỏ các đoạn của tài liệu. */
    async deleteDocument(userId: string, fileId: string) {
        const file = await this.mediaFileService.getOne(null, {
            _id: fileId,
            kind: MediaFileKind.DOCUMENT,
        });
        if (!file?.meetingId)
            throw ApiError.NotFound("error-document-not-found");
        const meeting = await this.meetingFor(
            userId,
            file.meetingId,
            DOCUMENT_EDIT_PERMISSION,
        );

        await this.mediaFileService.updateById(null, file._id, {
            status: MediaFileStatus.DELETED,
        });
        await this.mediaFileService.deleteById(null, file._id);
        await this.knowledgeIndexService.deleteSource(meeting.workspaceId, {
            meetingId: meeting._id,
            sourceType: "document",
            sourceId: file._id,
        });
        try {
            await this.minioService.removeObject(file.objectKey, file.bucket);
        } catch (err) {
            // Bản ghi đã xoá và AI đã được báo; object sót lại không lộ ra đâu.
            this.logger.warn(
                `Không gỡ được object ${file.objectKey}: ${err.message}`,
            );
        }
        return { deleted: true, fileId: file._id };
    }
}

function toDocument(file: MediaFile) {
    return {
        _id: file._id,
        meetingId: file.meetingId,
        fileName: file.originalName || file.objectKey.split("/").pop(),
        mimetype: file.mimetype,
        sizeBytes: file.sizeBytes,
        uploadedById: file.uploadedById ?? null,
        createdAt: (file as { createdAt?: Date }).createdAt ?? null,
    };
}
