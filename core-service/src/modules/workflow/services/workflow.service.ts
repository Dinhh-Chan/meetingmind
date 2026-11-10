import { ApiError } from "@config/exception/api-error";
import { ActionItemCommentService } from "@module/action-item-comment/services/action-item-comment.service";
import {
    ActionItemPriority,
    ActionItemSource,
    ActionItemStatus,
} from "@module/action-item/common/constant";
import { ActionItem } from "@module/action-item/entities/action-item.entity";
import { ActionItemService } from "@module/action-item/services/action-item.service";
import { AgendaItemService } from "@module/agenda-item/services/agenda-item.service";
import { MeetingAccessRole } from "@module/meeting-access/common/constant";
import { MeetingAccessService } from "@module/meeting-access/services/meeting-access.service";
import { DecisionSource, DecisionStatus } from "@module/decision/common/constant";
import { DecisionService } from "@module/decision/services/decision.service";
import {
    KnowledgeIndexService,
    reviewExtraOf,
} from "@module/knowledge/services/knowledge-index.service";
import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { MeetingParticipantRole } from "@module/meeting-participant/common/constant";
import { MeetingParticipantService } from "@module/meeting-participant/services/meeting-participant.service";
import {
    MeetingAccessScope,
    MeetingSourceType,
    MeetingStatus,
} from "@module/meeting/common/constant";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { MinutesVersionStatus } from "@module/minutes-version/common/constant";
import { MinutesVersionService } from "@module/minutes-version/services/minutes-version.service";
import { NoteType, NoteVisibility } from "@module/note/common/constant";
import { NoteService } from "@module/note/services/note.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { ReviewBatchService } from "@module/review-batch/services/review-batch.service";
import {
    ReviewItemStatus,
    ReviewItemType,
} from "@module/review-item/common/constant";
import { ReviewItemService } from "@module/review-item/services/review-item.service";
import { MeetingProcessingService } from "@module/meeting-processing/services/meeting-processing.service";
import {
    EventType,
    TaskSyncCompletedPayload,
    TaskSyncRequestedPayload,
} from "@module/messaging/common/constant";
import { OutboxService } from "@module/messaging/services/outbox.service";
import { SpeakerAliasService } from "@module/speaker-alias/services/speaker-alias.service";
import { TranscriptSegmentService } from "@module/transcript-segment/services/transcript-segment.service";
import { TranscriptVersionService } from "@module/transcript-version/services/transcript-version.service";
import { UserService } from "@module/user/service/user.service";
import {
    WorkspaceMemberRole,
    WorkspaceMemberStatus,
} from "@module/workspace-member/common/constant";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { Injectable, Logger } from "@nestjs/common";

/** Ghi chú cá nhân được chủ sở hữu cho phép đưa vào biên bản (§6.7). */
export const NOTE_TAG_IN_MINUTES = "use_in_minutes";

export interface CreateMeetingInput {
    workspaceId: string;
    projectId?: string;
    title: string;
    description?: string;
    sourceType: MeetingSourceType;
    meetingUrl?: string;
    accessScope?: MeetingAccessScope;
    scheduledStartAt?: string;
    durationMin?: number;
    agenda?: { title: string; plannedMinutes?: number }[];
    participantIds?: string[];
}

export interface TaskPatch {
    title?: string;
    status?: ActionItemStatus;
    blockedReason?: string;
    assigneeId?: string | null;
    deadline?: string | null;
    priority?: ActionItemPriority;
}

/**
 * Thao tác nghiệp vụ mà route CRUD chung không làm đúng được: route chung chỉ
 * xét một quyền theo phạm vi request, trong khi các bước dưới đây cần điều
 * kiện "cuộc họp mình tạo", "task giao cho mình", "ghi chú của mình", hoặc
 * phải đổi nhiều bảng cùng lúc.
 */
@Injectable()
export class WorkflowService {
    private readonly logger = new Logger(WorkflowService.name);

    constructor(
        private readonly permissionService: PermissionService,
        private readonly meetingService: MeetingService,
        private readonly meetingMinutesService: MeetingMinutesService,
        private readonly minutesVersionService: MinutesVersionService,
        private readonly reviewBatchService: ReviewBatchService,
        private readonly reviewItemService: ReviewItemService,
        private readonly actionItemService: ActionItemService,
        private readonly actionItemCommentService: ActionItemCommentService,
        private readonly decisionService: DecisionService,
        private readonly noteService: NoteService,
        private readonly agendaItemService: AgendaItemService,
        private readonly meetingParticipantService: MeetingParticipantService,
        private readonly transcriptVersionService: TranscriptVersionService,
        private readonly transcriptSegmentService: TranscriptSegmentService,
        private readonly speakerAliasService: SpeakerAliasService,
        private readonly meetingProcessingService: MeetingProcessingService,
        private readonly outboxService: OutboxService,
        private readonly workspaceMemberService: WorkspaceMemberService,
        private readonly userService: UserService,
        private readonly meetingAccessService: MeetingAccessService,
        private readonly knowledgeIndexService: KnowledgeIndexService,
    ) {}

    /* ------------------------------------------------------- tiện ích */

    private async meetingFor(
        userId: string,
        meetingId: string,
        permission: Permission,
    ): Promise<Meeting> {
        const meeting = await this.meetingService.getOne(null, {
            _id: meetingId,
            deletedAt: null,
        });
        if (!meeting) throw ApiError.NotFound("error-meeting-not-found");
        await this.permissionService.assertOnMeeting(userId, meeting, permission);
        return meeting;
    }

    /**
     * Lập chỉ mục tri thức là việc phụ của thao tác nghiệp vụ: bản ghi chính
     * thức đã lưu thì không được trả lỗi cho người dùng chỉ vì bước này. Thiếu
     * thì bù bằng POST /workflow/knowledge/reindex.
     */
    private async indexQuietly(what: string, run: () => Promise<unknown>) {
        try {
            await run();
        } catch (err) {
            this.logger.warn(`Không xin lập chỉ mục ${what}: ${err.message}`);
        }
    }

    private async taskFor(
        userId: string,
        taskId: string,
        permission: Permission,
    ): Promise<ActionItem> {
        const task = await this.actionItemService.getOne(null, {
            _id: taskId,
            deletedAt: null,
        });
        if (!task) throw ApiError.NotFound("error-task-not-found");
        await this.permissionService.assertOnTask(userId, task, permission);
        return task;
    }

    /* ------------------------------------------------------- cuộc họp */

    /** Tạo cuộc họp kèm agenda và người tham dự trong một lần gọi. */
    async createMeeting(userId: string, input: CreateMeetingInput) {
        await this.permissionService.assert(
            userId,
            input.workspaceId,
            Permission.MEETING_CREATE,
            { projectId: input.projectId },
        );
        // Kiểm tra người tham dự trước khi ghi gì: lỗi giữa chừng không để lại
        // cuộc họp tạo dở.
        const participantIds = [...new Set([userId, ...(input.participantIds ?? [])])];
        const members = await this.workspaceMemberService.getMany(null, {
            workspaceId: input.workspaceId,
            userId: { $in: participantIds },
        });
        if (members.length !== participantIds.length) {
            throw ApiError.BadRequest("error-user-not-in-workspace");
        }
        const users = await this.userService.getMany(
            null,
            { _id: { $in: participantIds } },
            { enableDataPartition: false },
        );
        const userOf = new Map(users.map((u) => [u._id, u]));

        // Cuộc họp không thuộc dự án thì không có quyền dự án nào để dựa vào:
        // phải giới hạn theo danh sách truy cập, không thì cả người tạo cũng
        // không xem được.
        const accessScope = input.projectId
            ? (input.accessScope ?? MeetingAccessScope.PROJECT)
            : MeetingAccessScope.RESTRICTED;

        const start = input.scheduledStartAt
            ? new Date(input.scheduledStartAt)
            : undefined;
        const end =
            start && input.durationMin
                ? new Date(start.getTime() + input.durationMin * 60000)
                : undefined;

        const meeting = await this.meetingService.create(null, {
            workspaceId: input.workspaceId,
            projectId: input.projectId || null,
            title: input.title,
            description: input.description,
            sourceType: input.sourceType,
            meetingUrl: input.meetingUrl,
            language: "vi",
            accessScope,
            // Tải tệp lên thì cuộc họp coi như đã diễn ra.
            status:
                input.sourceType === MeetingSourceType.UPLOAD
                    ? MeetingStatus.ENDED
                    : MeetingStatus.SCHEDULED,
            scheduledStartAt: start,
            scheduledEndAt: end,
            createdById: userId,
        });

        const agenda = (input.agenda ?? []).filter((a) => a.title?.trim());
        for (const [i, item] of agenda.entries()) {
            await this.agendaItemService.create(null, {
                workspaceId: input.workspaceId,
                meetingId: meeting._id,
                title: item.title.trim(),
                sequence: i + 1,
                plannedMinutes: item.plannedMinutes,
            });
        }

        for (const participantId of participantIds) {
            const u = userOf.get(participantId);
            await this.meetingParticipantService.create(null, {
                workspaceId: input.workspaceId,
                meetingId: meeting._id,
                userId: participantId,
                displayName: u?.fullname || u?.username || participantId,
                email: u?.email,
                role:
                    participantId === userId
                        ? MeetingParticipantRole.HOST
                        : MeetingParticipantRole.PARTICIPANT,
            });
        }
        if (accessScope === MeetingAccessScope.RESTRICTED) {
            // MeetingService.create đã cấp MANAGER cho người tạo; người tham dự
            // khác được xem.
            for (const participantId of participantIds) {
                if (participantId === userId) continue;
                await this.meetingAccessService.create(null, {
                    workspaceId: input.workspaceId,
                    meetingId: meeting._id,
                    userId: participantId,
                    role: MeetingAccessRole.VIEWER,
                    grantedById: userId,
                });
            }
        }
        return meeting;
    }

    /** Agenda và người tham dự của một cuộc họp. */
    async getMeetingInfo(userId: string, meetingId: string) {
        await this.meetingFor(userId, meetingId, Permission.MEETING_VIEW);
        const [agenda, participants] = await Promise.all([
            this.agendaItemService.getMany(null, { meetingId }),
            this.meetingParticipantService.getMany(null, { meetingId }),
        ]);
        return {
            agenda: [...agenda].sort((a, b) => a.sequence - b.sequence),
            participants,
        };
    }

    /* ------------------------------------------------------- biên bản */

    private async currentMinutes(meetingId: string) {
        const minutes = await this.meetingMinutesService.getOne(null, {
            meetingId,
        });
        if (!minutes?.currentVersionId) {
            throw ApiError.NotFound("error-minutes-not-found");
        }
        const version = await this.minutesVersionService.getById(
            null,
            minutes.currentVersionId,
        );
        if (!version) throw ApiError.NotFound("error-minutes-not-found");
        return { minutes, version };
    }

    private expectStatus(actual: string, ...expected: MinutesVersionStatus[]) {
        if (!expected.includes(actual as MinutesVersionStatus)) {
            throw ApiError.BadRequest("error-minutes-status-invalid");
        }
    }

    /** Nháp → chờ duyệt. Người sửa được nháp gửi duyệt được. */
    async submitMinutes(userId: string, meetingId: string) {
        await this.meetingFor(userId, meetingId, Permission.MINUTES_UPDATE_DRAFT);
        const { version } = await this.currentMinutes(meetingId);
        this.expectStatus(version.status, MinutesVersionStatus.DRAFT);
        return this.minutesVersionService.updateById(null, version._id, {
            status: MinutesVersionStatus.PENDING_APPROVAL,
        });
    }

    /**
     * Nháp hoặc chờ duyệt → đã duyệt. Chỉ người có quyền duyệt (PM, Owner/Admin);
     * người duyệt duyệt thẳng bản nháp được, khỏi gửi duyệt cho chính mình.
     */
    async approveMinutes(userId: string, meetingId: string) {
        const meeting = await this.meetingFor(userId, meetingId, Permission.MINUTES_APPROVE);
        const { minutes, version } = await this.currentMinutes(meetingId);
        this.expectStatus(
            version.status,
            MinutesVersionStatus.DRAFT,
            MinutesVersionStatus.PENDING_APPROVAL,
        );
        const approved = await this.minutesVersionService.updateById(
            null,
            version._id,
            {
                status: MinutesVersionStatus.APPROVED,
                approvedById: userId,
                approvedAt: new Date(),
            },
        );
        await this.meetingMinutesService.updateById(null, minutes._id, {
            approvedVersionId: version._id,
        });
        // Chỉ bản đã duyệt vào kho hỏi đáp; ai-worker bỏ bản duyệt trước của
        // cùng cuộc họp.
        await this.indexQuietly(`biên bản ${version._id}`, () =>
            this.knowledgeIndexService.indexMinutes(meeting, approved),
        );
        return approved;
    }

    /**
     * Không duyệt: bắt buộc nêu lý do, biên bản về nháp để người tạo sửa.
     * Lý do lưu ở phiên bản và hiện lại cho người tạo cuộc họp.
     */
    async rejectMinutes(userId: string, meetingId: string, reason: string) {
        await this.meetingFor(userId, meetingId, Permission.MINUTES_APPROVE);
        const text = reason?.trim();
        if (!text) throw ApiError.BadRequest("error-reject-reason-required");
        const { version } = await this.currentMinutes(meetingId);
        this.expectStatus(
            version.status,
            MinutesVersionStatus.DRAFT,
            MinutesVersionStatus.PENDING_APPROVAL,
        );
        return this.minutesVersionService.updateById(null, version._id, {
            status: MinutesVersionStatus.DRAFT,
            rejectedReason: text,
            rejectedById: userId,
            rejectedAt: new Date(),
        });
    }

    /**
     * Biên bản đã duyệt không sửa trực tiếp (§13.5): tạo phiên bản nháp mới
     * chép nội dung bản đã duyệt, bản cũ giữ nguyên.
     */
    async newMinutesDraft(userId: string, meetingId: string) {
        await this.meetingFor(userId, meetingId, Permission.MINUTES_APPROVE);
        const { minutes, version } = await this.currentMinutes(meetingId);
        this.expectStatus(version.status, MinutesVersionStatus.APPROVED);
        const draft = await this.minutesVersionService.create(null, {
            workspaceId: version.workspaceId,
            meetingMinutesId: minutes._id,
            versionNo: version.versionNo + 1,
            summary: version.summary,
            openIssues: version.openIssues,
            editorContent: version.editorContent,
            templateKey: version.templateKey,
            status: MinutesVersionStatus.DRAFT,
            sourceTranscriptVersionId: version.sourceTranscriptVersionId,
        });
        await this.meetingMinutesService.updateById(null, minutes._id, {
            currentVersionId: draft._id,
        });
        return draft;
    }

    /* ------------------------------------------------------- đề xuất AI */

    private async reviewFor(userId: string, reviewItemId: string, permission: Permission) {
        const item = await this.reviewItemService.getById(null, reviewItemId);
        if (!item) throw ApiError.NotFound("error-review-item-not-found");
        const batch = await this.reviewBatchService.getById(null, item.reviewBatchId);
        const meeting = await this.meetingFor(userId, batch.meetingId, permission);
        return { item, meeting };
    }

    /**
     * Duyệt một đề xuất. Chỉ đề xuất đã duyệt mới thành task/quyết định chính
     * thức, mỗi đề xuất sinh tối đa một bản ghi (§6.9).
     */
    async approveReview(
        userId: string,
        reviewItemId: string,
        edit: { title?: string; assigneeId?: string | null; deadline?: string | null; priority?: ActionItemPriority },
    ) {
        const { item, meeting } = await this.reviewFor(userId, reviewItemId, Permission.REVIEW_APPROVE);
        if (item.status === ReviewItemStatus.APPROVED) return item;

        const payload: Record<string, unknown> = { ...(item.payload as Record<string, unknown>), ...edit };
        const title = String(payload.title ?? "").trim();
        if (!title) throw ApiError.BadRequest("error-review-title-required");

        const patch: Record<string, unknown> = {
            status: ReviewItemStatus.APPROVED,
            payload,
            editedById: userId,
            editedAt: new Date(),
        };
        // Mô tả và câu gốc chỉ nằm trong đề xuất; đưa kèm vào kho hỏi đáp.
        const extra = reviewExtraOf(payload);
        if (item.type === ReviewItemType.ACTION_ITEM) {
            const task = await this.actionItemService.create(null, {
                workspaceId: meeting.workspaceId,
                projectId: meeting.projectId,
                meetingId: meeting._id,
                reviewItemId: item._id,
                title,
                proposerId: meeting.createdById,
                assigneeId: (payload.assigneeId as string) || null,
                approverId: userId,
                deadline: payload.deadline ? new Date(payload.deadline as string) : null,
                deadlineRawText: payload.deadlineRawText as string,
                // AI chỉ đọc được câu gốc ("thứ Sáu") mà người duyệt chưa chốt ngày.
                deadlineNeedsConfirm:
                    !payload.deadline && Boolean(payload.deadlineRawText),
                priority: (payload.priority as ActionItemPriority) || ActionItemPriority.MEDIUM,
                status: ActionItemStatus.TODO,
                source: ActionItemSource.AI,
                confidence: payload.confidence as number,
                createdById: userId,
            });
            patch.actionItemId = task._id;
            await this.requestTaskSync(task, meeting, payload);
            await this.indexQuietly(`công việc ${task._id}`, () =>
                this.knowledgeIndexService.indexActionItem(meeting, task, extra),
            );
        } else if (item.type === ReviewItemType.DECISION) {
            const decision = await this.decisionService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
                title,
                decidedById: userId,
                status: DecisionStatus.AGREED,
                source: DecisionSource.AI,
                reviewItemId: item._id,
            });
            patch.decisionId = decision._id;
            await this.indexQuietly(`quyết định ${decision._id}`, () =>
                this.knowledgeIndexService.indexDecision(meeting, decision, extra),
            );
        }
        return this.reviewItemService.updateById(null, item._id, patch);
    }

    async rejectReview(userId: string, reviewItemId: string, reason?: string) {
        const { item } = await this.reviewFor(userId, reviewItemId, Permission.REVIEW_APPROVE);
        if (item.status === ReviewItemStatus.APPROVED) {
            throw ApiError.BadRequest("error-review-already-approved");
        }
        return this.reviewItemService.updateById(null, item._id, {
            status: ReviewItemStatus.REJECTED,
            rejectReason: reason,
            editedById: userId,
            editedAt: new Date(),
        });
    }

    /** Sửa nội dung đề xuất trước khi duyệt (người tạo cuộc họp cũng được). */
    async editReview(userId: string, reviewItemId: string, edit: Record<string, unknown>) {
        const { item } = await this.reviewFor(userId, reviewItemId, Permission.REVIEW_UPDATE);
        return this.reviewItemService.updateById(null, item._id, {
            payload: { ...(item.payload as Record<string, unknown>), ...edit },
            editedById: userId,
            editedAt: new Date(),
        });
    }

    /* ------------------------------------------------------- task */

    /**
     * Cập nhật task. Đổi trạng thái: PM/Admin hoặc người được giao. Giao
     * người, đổi hạn/ưu tiên/tiêu đề: chỉ người có quyền lên kế hoạch (§13.6).
     */
    async updateTask(userId: string, taskId: string, patch: TaskPatch) {
        const current = await this.taskFor(userId, taskId, Permission.TASK_VIEW);
        // Giao diện gửi lại cả trường không đổi: chỉ tính là "lên kế hoạch" khi
        // giá trị thật sự khác, để người được giao vẫn đổi được trạng thái.
        const dayOf = (d: Date | string | null | undefined) =>
            d ? new Date(d).toISOString().slice(0, 10) : null;
        const update: Record<string, unknown> = {};
        if (patch.title !== undefined && patch.title !== current.title) {
            update.title = patch.title;
        }
        if (
            patch.assigneeId !== undefined &&
            (patch.assigneeId ?? null) !== (current.assigneeId ?? null)
        ) {
            update.assigneeId = patch.assigneeId;
        }
        if (patch.priority !== undefined && patch.priority !== current.priority) {
            update.priority = patch.priority;
        }
        if (
            patch.deadline !== undefined &&
            dayOf(patch.deadline) !== dayOf(current.deadline)
        ) {
            update.deadline = patch.deadline ? new Date(patch.deadline) : null;
        }
        const planning = Object.keys(update).length > 0;
        const task = await this.taskFor(
            userId,
            taskId,
            planning ? Permission.TASK_ASSIGN : Permission.TASK_STATUS_UPDATE,
        );
        if (patch.status) update.status = patch.status;
        // Lý do bị chặn chưa có cột riêng: ghi vào mô tả để không mất.
        if (patch.status === ActionItemStatus.BLOCKED && patch.blockedReason) {
            update.description = patch.blockedReason;
        }
        const updated = await this.actionItemService.updateById(null, task._id, update);
        // Người làm, hạn, trạng thái đổi thì câu trả lời "ai làm gì" phải đổi theo.
        if (updated?.meetingId) {
            await this.indexQuietly(`công việc ${task._id}`, async () => {
                const meeting = await this.meetingService.getOne(null, {
                    _id: updated.meetingId,
                    deletedAt: null,
                });
                if (!meeting) return;
                const review = updated.reviewItemId
                    ? await this.reviewItemService.getById(null, updated.reviewItemId)
                    : null;
                await this.knowledgeIndexService.indexActionItem(
                    meeting,
                    updated,
                    reviewExtraOf(review?.payload),
                );
            });
        }
        return updated;
    }

    async getTaskComments(userId: string, taskId: string) {
        await this.taskFor(userId, taskId, Permission.TASK_VIEW);
        const comments = await this.actionItemCommentService.getMany(null, {
            actionItemId: taskId,
            deletedAt: null,
        });
        return [...comments].sort(
            (a, b) =>
                new Date((a as { createdAt?: Date }).createdAt ?? 0).getTime() -
                new Date((b as { createdAt?: Date }).createdAt ?? 0).getTime(),
        );
    }

    async addTaskComment(userId: string, taskId: string, body: string) {
        const task = await this.taskFor(userId, taskId, Permission.TASK_COMMENT_CREATE);
        if (!body?.trim()) throw ApiError.BadRequest("error-comment-empty");
        return this.actionItemCommentService.create(null, {
            workspaceId: task.workspaceId,
            actionItemId: task._id,
            authorId: userId,
            body: body.trim(),
        });
    }

    /* ------------------------------------------------------- ghi chú */

    /** Ghi chú chia sẻ của mọi người và ghi chú cá nhân của chính mình. */
    async getNotes(userId: string, meetingId: string) {
        await this.meetingFor(userId, meetingId, Permission.MEETING_VIEW);
        const notes = await this.noteService.getMany(null, {
            meetingId,
            deletedAt: null,
        });
        return notes.filter(
            (n) => n.visibility === NoteVisibility.SHARED || n.authorId === userId,
        );
    }

    async addNote(
        userId: string,
        meetingId: string,
        input: { body: string; type?: NoteType; visibility?: NoteVisibility; recordingMs?: number },
    ) {
        const meeting = await this.meetingFor(userId, meetingId, Permission.MEETING_VIEW);
        if (!input.body?.trim()) throw ApiError.BadRequest("error-note-empty");
        const visibility = input.visibility ?? NoteVisibility.SHARED;
        return this.noteService.create(null, {
            workspaceId: meeting.workspaceId,
            meetingId,
            authorId: userId,
            type: input.type ?? NoteType.INFO,
            visibility,
            sharedAt: visibility === NoteVisibility.SHARED ? new Date() : null,
            body: input.body.trim(),
            recordingMs: input.recordingMs,
            tags: [],
        });
    }

    /** Chỉ chủ ghi chú bật/tắt "Dùng cho biên bản". */
    async toggleNoteInMinutes(userId: string, noteId: string) {
        const note = await this.noteService.getById(null, noteId);
        if (!note || note.deletedAt) throw ApiError.NotFound("error-note-not-found");
        if (note.authorId !== userId) throw ApiError.Forbidden("error-forbidden");
        const tags = new Set<string>((note.tags as unknown as string[]) ?? []);
        if (tags.has(NOTE_TAG_IN_MINUTES)) tags.delete(NOTE_TAG_IN_MINUTES);
        else tags.add(NOTE_TAG_IN_MINUTES);
        return this.noteService.updateById(null, note._id, { tags: [...tags] });
    }

    /* ------------------------------------------------------- người nói */

    /**
     * Gắn một nhãn người nói với một thành viên. Không đổi người được giao của
     * task đã duyệt: chỉ đánh dấu task lấy từ cuộc họp này là cần rà soát (§6.5).
     */
    async assignSpeaker(
        userId: string,
        meetingId: string,
        speakerLabel: string,
        targetUserId: string | null,
    ) {
        const meeting = await this.meetingFor(userId, meetingId, Permission.TRANSCRIPT_UPDATE);
        const version = await this.transcriptVersionService.getOne(null, {
            meetingId,
            isCurrent: true,
        });
        if (!version) throw ApiError.NotFound("error-transcript-not-found");

        if (targetUserId) {
            const member = await this.workspaceMemberService.getOne(null, {
                workspaceId: meeting.workspaceId,
                userId: targetUserId,
            });
            if (!member) throw ApiError.BadRequest("error-user-not-in-workspace");
        }

        const segments = await this.transcriptSegmentService.getMany(null, {
            transcriptVersionId: version._id,
            speakerLabel,
        });
        for (const segment of segments) {
            await this.transcriptSegmentService.updateById(null, segment._id, {
                speakerUserId: targetUserId,
                identityStatus: targetUserId ? "confirmed" : "unknown",
            });
        }

        const alias = await this.speakerAliasService.getOne(null, {
            transcriptVersionId: version._id,
            speakerLabel,
        });
        // Tên hiển thị đi kèm transcript sang AI khi phân tích lại: AI ghi người
        // thực hiện theo tên này thay vì "Người nói 2".
        let displayName = speakerLabel;
        if (targetUserId) {
            const [target] = await this.userService.getMany(
                null,
                { _id: targetUserId },
                { enableDataPartition: false } as any,
            );
            displayName = target?.fullname || target?.username || speakerLabel;
        }
        const aliasData = {
            displayName,
            userId: targetUserId,
            confirmedById: targetUserId ? userId : null,
            confirmedAt: targetUserId ? new Date() : null,
        };
        if (alias) {
            await this.speakerAliasService.updateById(null, alias._id, aliasData);
        } else {
            await this.speakerAliasService.create(null, {
                workspaceId: meeting.workspaceId,
                meetingId,
                transcriptVersionId: version._id,
                speakerLabel,
                ...aliasData,
            });
        }

        const tasks = await this.actionItemService.getMany(null, {
            meetingId,
            deletedAt: null,
        });
        for (const task of tasks) {
            await this.actionItemService.updateById(null, task._id, {
                needsReviewReason: "speaker_changed",
            });
        }
        // Tên người nói đổi: lập lại chỉ mục để câu "ai nói gì" dùng tên mới.
        await this.meetingProcessingService.indexTranscript(meeting, version._id);
        return { updatedSegments: segments.length };
    }

    /**
     * Công việc đã duyệt mới được đẩy ra ngoài (Trello, Telegram). Ghi vào
     * outbox để không mất sự kiện; integration-service tự bỏ qua nhà cung cấp
     * chưa cấu hình.
     */
    private async requestTaskSync(
        task: { _id: string; title: string; assigneeId?: string | null; deadline?: Date | null; deadlineRawText?: string; priority: string },
        meeting: Meeting,
        payload: Record<string, unknown>,
    ) {
        let assigneeName: string | undefined;
        if (task.assigneeId) {
            const [assignee] = await this.userService.getMany(
                null,
                { _id: task.assigneeId },
                { enableDataPartition: false } as any,
            );
            assigneeName = assignee?.fullname || assignee?.username;
        }
        const body: TaskSyncRequestedPayload = {
            actionItemId: task._id,
            meetingId: meeting._id,
            idempotencyKey: `${task._id}:push`,
            task: {
                title: task.title,
                description: (payload.description as string) || undefined,
                assigneeName: assigneeName ?? ((payload.assigneeHint as string) || undefined),
                deadline: task.deadline ? new Date(task.deadline).toISOString() : undefined,
                deadlineRawText: task.deadlineRawText || undefined,
                priority: task.priority,
                meetingTitle: meeting.title,
                sourceQuote: (payload.quote as string) || undefined,
            },
        };
        await this.outboxService.emit({
            aggregateType: "action_item",
            aggregateId: task._id,
            eventType: EventType.TASK_SYNC_REQUESTED,
            workspaceId: meeting.workspaceId,
            payload: body,
        });
    }

    /** integration-service báo kết quả đồng bộ: lưu liên kết để giao diện hiện. */
    async onTaskSyncCompleted(payload: TaskSyncCompletedPayload) {
        const task = await this.actionItemService.getOne(null, { _id: payload.actionItemId });
        if (!task) {
            this.logger.warn(`Kết quả đồng bộ cho công việc không tồn tại ${payload.actionItemId}`);
            return;
        }
        const syncedAt = new Date().toISOString();
        await this.actionItemService.updateById(null, payload.actionItemId, {
            externalLinks: payload.results.map((r) => ({ ...r, syncedAt })),
        });
        const summary = payload.results.map((r) => `${r.provider}=${r.status}`).join(", ");
        this.logger.log(`Đồng bộ công việc ${payload.actionItemId}: ${summary}`);
    }

    /**
     * Chạy lại phân tích AI trên transcript hiện tại, thường sau khi đã gán tên
     * người nói. Tạo biên bản nháp và lô đề xuất mới; bản đã duyệt giữ nguyên.
     */
    async reanalyze(userId: string, meetingId: string) {
        const meeting = await this.meetingFor(userId, meetingId, Permission.MINUTES_UPDATE_DRAFT);
        const version = await this.transcriptVersionService.getOne(null, {
            meetingId,
            isCurrent: true,
        });
        if (!version) throw ApiError.NotFound("error-transcript-not-found");
        return this.meetingProcessingService.requestAnalysis(meeting, version._id, {
            rerun: true,
        });
    }

    /* ------------------------------------------------------- thành viên */

    /** Thêm một tài khoản đã có vào workspace theo email hoặc tên đăng nhập. */
    async inviteMember(
        userId: string,
        workspaceId: string,
        identifier: string,
        role: WorkspaceMemberRole,
    ) {
        await this.permissionService.assert(
            userId,
            workspaceId,
            Permission.WORKSPACE_MEMBER_INVITE,
        );
        if (role === WorkspaceMemberRole.OWNER) {
            throw ApiError.BadRequest("error-role-invalid");
        }
        const key = identifier.trim().toLowerCase();
        const [byEmail] = await this.userService.getMany(null, { email: key }, { enableDataPartition: false });
        const [byName] = byEmail
            ? [byEmail]
            : await this.userService.getMany(null, { username: key }, { enableDataPartition: false });
        if (!byName) throw ApiError.NotFound("error-user-not-found");

        const existing = await this.workspaceMemberService.getOne(null, {
            workspaceId,
            userId: byName._id,
        });
        if (existing) return existing;
        return this.workspaceMemberService.create(null, {
            workspaceId,
            userId: byName._id,
            role,
            status: WorkspaceMemberStatus.ACTIVE,
            joinedAt: new Date(),
        });
    }
}
