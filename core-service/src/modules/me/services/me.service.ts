import { ActionItemService } from "@module/action-item/services/action-item.service";
import { ReviewBatchService } from "@module/review-batch/services/review-batch.service";
import { ReviewItemService } from "@module/review-item/services/review-item.service";
import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { MeetingParticipantService } from "@module/meeting-participant/services/meeting-participant.service";
import { MeetingRecords, MeetingRecordService } from "@module/meeting-record/meeting-record.service";
import { ClarificationRequestService } from "@module/clarification-request/services/clarification-request.service";
import { MeetingStatus } from "@module/meeting/common/constant";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { MinutesVersionStatus } from "@module/minutes-version/common/constant";
import { MinutesVersionService } from "@module/minutes-version/services/minutes-version.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { ProcessingJobStatus } from "@module/processing-job/common/constant";
import { ProcessingJobService } from "@module/processing-job/services/processing-job.service";
import { ProjectMemberService } from "@module/project-member/services/project-member.service";
import { ProjectService } from "@module/project/services/project.service";
import { UserService } from "@module/user/service/user.service";
import {
    WorkspaceMemberRole,
    WorkspaceMemberStatus,
} from "@module/workspace-member/common/constant";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { WorkspaceService } from "@module/workspace/services/workspace.service";
import { Injectable } from "@nestjs/common";

/**
 * Giai đoạn hiển thị của cuộc họp, gộp từ `meetings.status`, job xử lý gần
 * nhất và trạng thái biên bản. Cùng tên với `MeetingPhase` phía frontend.
 */
export type MeetingPhase =
    | "scheduled"
    | "processing"
    | "failed"
    | "pending_review"
    | "completed";

export type NotificationKind =
    | "workspace_added"
    | "meeting_added"
    | "project_added"
    | "task_assigned"
    | "minutes_pending"
    | "minutes_approved"
    | "minutes_rejected"
    | "clarification_requested"
    | "clarification_answered";

export interface NotificationItem {
    id: string;
    kind: NotificationKind;
    /** Tên cuộc họp, dự án, task hoặc workspace. */
    title: string;
    /** Lý do không duyệt, vai trò trong dự án… */
    detail?: string;
    actorName?: string;
    meetingId?: string;
    projectId?: string;
    taskId?: string;
    at: string;
}

/** Chuông chỉ giữ thông báo trong khoảng này. */
const NOTIFICATION_DAYS = 30;

/**
 * Các danh sách "của tôi" mà frontend cần ngay sau khi đăng nhập.
 *
 * Route CRUD chung (`/meeting/page`, `/project/page`) xét quyền theo một
 * project cụ thể, nên không liệt kê được "mọi thứ tôi xem được" trong
 * workspace. Ở đây lọc từng bản ghi qua đúng `PermissionService` mà guard
 * dùng, để danh sách khớp với việc mở chi tiết.
 */
@Injectable()
export class MeService {
    constructor(
        private readonly permissionService: PermissionService,
        private readonly meetingRecordService: MeetingRecordService,
        private readonly clarificationRequestService: ClarificationRequestService,
        private readonly workspaceService: WorkspaceService,
        private readonly workspaceMemberService: WorkspaceMemberService,
        private readonly projectService: ProjectService,
        private readonly meetingService: MeetingService,
        private readonly meetingMinutesService: MeetingMinutesService,
        private readonly meetingParticipantService: MeetingParticipantService,
        private readonly projectMemberService: ProjectMemberService,
        private readonly minutesVersionService: MinutesVersionService,
        private readonly processingJobService: ProcessingJobService,
        private readonly userService: UserService,
        private readonly actionItemService: ActionItemService,
        private readonly reviewBatchService: ReviewBatchService,
        private readonly reviewItemService: ReviewItemService,
    ) {}

    async getWorkspaces(userId: string) {
        const memberships = await this.workspaceMemberService.getMany(null, {
            userId,
            status: WorkspaceMemberStatus.ACTIVE,
        });
        if (!memberships.length) return [];

        const workspaces = await this.workspaceService.getMany(null, {
            _id: { $in: memberships.map((m) => m.workspaceId) },
            deletedAt: null,
        });
        const roleOf = new Map(memberships.map((m) => [m.workspaceId, m.role]));
        return workspaces.map((w) => ({ ...w, role: roleOf.get(w._id) }));
    }

    async getMembers(userId: string, workspaceId: string) {
        await this.permissionService.assert(
            userId,
            workspaceId,
            Permission.WORKSPACE_VIEW,
        );
        const members = await this.workspaceMemberService.getMany(null, {
            workspaceId,
        });
        const users = members.length
            ? await this.userService.getMany(
                  null,
                  { _id: { $in: members.map((m) => m.userId) } },
                  { enableDataPartition: false },
              )
            : [];
        const userOf = new Map(users.map((u) => [u._id, u]));
        return members.map((m) => {
            const u = userOf.get(m.userId);
            return {
                ...m,
                username: u?.username,
                fullname: u?.fullname,
                email: u?.email,
            };
        });
    }

    async getProjects(userId: string, workspaceId: string) {
        await this.permissionService.assert(
            userId,
            workspaceId,
            Permission.WORKSPACE_VIEW,
        );
        const projects = await this.projectService.getMany(null, {
            workspaceId,
            deletedAt: null,
        });
        const allMembers = await this.projectMemberService.getMany(null, { workspaceId });
        const visible = [];
        for (const project of projects) {
            const granted = await this.permissionService.resolve(
                userId,
                workspaceId,
                { projectId: project._id },
            );
            if (!granted.has(Permission.PROJECT_VIEW)) continue;
            const myRole =
                (await this.permissionService.getProjectRole(
                    userId,
                    workspaceId,
                    project._id,
                )) ??
                // OWNER/ADMIN workspace được coi như PM ở mọi project.
                (granted.has(Permission.PROJECT_PM_MANAGE) ? "PM" : null);
            const members = allMembers
                .filter((m) => m.projectId === project._id)
                .map((m) => ({ userId: m.userId, role: m.role, discipline: m.discipline }));
            visible.push({ ...project, myRole, members });
        }
        return visible;
    }

    /** Task mình xem được: theo project/cuộc họp, hoặc đang giao cho mình. */
    async getTasks(userId: string, workspaceId: string) {
        await this.permissionService.assert(
            userId,
            workspaceId,
            Permission.WORKSPACE_VIEW,
        );
        const tasks = await this.actionItemService.getMany(null, {
            workspaceId,
            deletedAt: null,
        });
        const visible = [];
        for (const task of tasks) {
            if (
                await this.permissionService.canOnTask(
                    userId,
                    task,
                    Permission.TASK_VIEW,
                )
            ) {
                visible.push(task);
            }
        }
        return visible;
    }

    /**
     * Đề xuất AI của các cuộc họp mình xem được, kèm `meetingId`, để màn
     * "Task cần duyệt" không phải mở từng cuộc họp. Chỉ lấy lô mới nhất của
     * mỗi cuộc họp — lô cũ ứng với lần phân tích trước.
     */
    /**
     * Đề xuất AI người này xem được: của bản ghi đứng đầu mỗi cuộc họp có biên
     * bản xem được (bản của mình, bản đã duyệt, hoặc mọi bản nếu là người
     * duyệt) — cùng bản mà trang chi tiết cuộc họp mở ra.
     */
    async getReviewItems(userId: string, workspaceId: string) {
        const { meetings, records } = await this.visibleMeetings(userId, workspaceId);
        const targets = meetings
            .map((m) => ({ meetingId: m._id, minutes: records.get(m._id)?.records.find((r) => r.minutes)?.minutes }))
            .filter((t) => t.minutes?.sourceTranscriptVersionId);
        if (!targets.length) return [];
        const batches = await this.reviewBatchService.getMany(null, {
            sourceTranscriptVersionId: { $in: targets.map((t) => t.minutes.sourceTranscriptVersionId) },
        });
        const chosen = new Map<string, string>();
        for (const { meetingId, minutes } of targets) {
            const own = batches.filter(
                (b) => b.meetingId === meetingId && b.sourceTranscriptVersionId === minutes.sourceTranscriptVersionId,
            );
            const batch =
                own.find((b) => minutes.aiRunId && b.aiRunId === minutes.aiRunId) ??
                own.sort((a, b) => createdAtOf(b) - createdAtOf(a))[0];
            if (batch) chosen.set(batch._id, meetingId);
        }
        if (!chosen.size) return [];
        const items = await this.reviewItemService.getMany(null, {
            reviewBatchId: { $in: [...chosen.keys()] },
        });
        return items.map((i) => ({
            ...i,
            meetingId: chosen.get(i.reviewBatchId),
        }));
    }

    /**
     * Thông báo dựng từ dữ liệu sẵn có thay vì bảng riêng: được thêm vào
     * workspace, cuộc họp, dự án; được giao việc; biên bản mình tạo được duyệt
     * hoặc bị trả lại; biên bản đang chờ mình duyệt. Chưa đọc = mới hơn lần
     * cuối mở chuông (`workspace_members.notificationsSeenAt`).
     */
    async getNotifications(userId: string, workspaceId: string) {
        const { meetings, records } = await this.visibleMeetings(userId, workspaceId);
        const membership = await this.workspaceMemberService.getOne(null, {
            workspaceId,
            userId,
        });
        const since = Date.now() - NOTIFICATION_DAYS * 86_400_000;
        const items: (NotificationItem & { actorId?: string })[] = [];
        const push = (
            item: Omit<NotificationItem, "at"> & { actorId?: string },
            at: Date | number | string | undefined,
        ) => {
            const time = at ? new Date(at).getTime() : 0;
            if (time >= since) items.push({ ...item, at: new Date(time).toISOString() });
        };

        if (membership && membership.role !== WorkspaceMemberRole.OWNER) {
            const workspace = await this.workspaceService.getById(null, workspaceId);
            push(
                { id: `workspace:${membership._id}`, kind: "workspace_added", title: workspace?.name ?? "" },
                membership.joinedAt ?? createdAtOf(membership),
            );
        }

        const meetingOf = new Map(meetings.map((m) => [m._id, m]));
        const participations = await this.meetingParticipantService.getMany(null, {
            workspaceId,
            userId,
        });
        for (const p of participations) {
            const m = meetingOf.get(p.meetingId);
            if (!m || m.createdById === userId) continue;
            push(
                { id: `meeting:${p._id}`, kind: "meeting_added", title: m.title, meetingId: m._id, actorId: m.createdById },
                createdAtOf(p),
            );
        }

        const projectMembers = await this.projectMemberService.getMany(null, {
            workspaceId,
            userId,
        });
        const projects = projectMembers.length
            ? await this.projectService.getMany(null, {
                  _id: { $in: projectMembers.map((m) => m.projectId) },
                  deletedAt: null,
              })
            : [];
        const projectOf = new Map(projects.map((p) => [p._id, p]));
        for (const pm of projectMembers) {
            const project = projectOf.get(pm.projectId);
            if (!project || project.createdById === userId) continue;
            push(
                {
                    id: `project:${pm._id}`,
                    kind: "project_added",
                    title: project.name,
                    detail: pm.role,
                    projectId: project._id,
                    actorId: project.createdById,
                },
                createdAtOf(pm),
            );
        }

        const tasks = await this.actionItemService.getMany(null, {
            workspaceId,
            assigneeId: userId,
            deletedAt: null,
        });
        for (const task of tasks) {
            // Task từ đề xuất AI: người duyệt là người giao.
            const actorId = task.approverId ?? task.createdById;
            if (actorId === userId) continue;
            push(
                { id: `task:${task._id}`, kind: "task_assigned", title: task.title, taskId: task._id, actorId },
                createdAtOf(task),
            );
        }

        // Yêu cầu làm rõ đề xuất: người được hỏi được báo câu hỏi, người hỏi
        // được báo câu trả lời. Tên việc lấy từ đề xuất.
        const [toMe, byMe] = await Promise.all([
            this.clarificationRequestService.getMany(null, { workspaceId, recipientId: userId }),
            this.clarificationRequestService.getMany(null, { workspaceId, askedById: userId }),
        ]);
        const asks = [...new Map([...toMe, ...byMe].map((a) => [a._id, a])).values()];
        if (asks.length) {
            const reviewItems = await this.reviewItemService.getMany(null, {
                _id: { $in: [...new Set(asks.map((a) => a.reviewItemId))] },
            });
            const titleOf = new Map(
                reviewItems.map((i) => [i._id, String((i.payload as Record<string, unknown>)?.title ?? "")]),
            );
            for (const a of asks) {
                const title = titleOf.get(a.reviewItemId) ?? "";
                if (a.recipientId === userId && a.askedById !== userId) {
                    push(
                        { id: `clarify:${a._id}`, kind: "clarification_requested", title, detail: a.question, meetingId: a.meetingId, actorId: a.askedById },
                        createdAtOf(a),
                    );
                }
                if (a.askedById === userId && a.answeredAt && a.recipientId !== userId) {
                    push(
                        { id: `answer:${a._id}`, kind: "clarification_answered", title, detail: a.answer, meetingId: a.meetingId, actorId: a.recipientId },
                        a.answeredAt,
                    );
                }
            }
        }

        // Biên bản: người ghi được báo khi bản của mình được duyệt hoặc bị trả
        // lại; người duyệt được báo bản đang chờ mình duyệt.
        for (const m of meetings) {
            const view = records.get(m._id);
            if (!view) continue;
            const canApprove =
                view.seeAll &&
                (await this.permissionService.can(userId, workspaceId, Permission.MINUTES_APPROVE, { meetingId: m._id }));
            for (const { minutes: v, mine } of view.records) {
                if (!v) continue;
                const base = { title: m.title, meetingId: m._id };
                if (mine) {
                    if (v.status === MinutesVersionStatus.APPROVED && v.approvedById && v.approvedById !== userId) {
                        push({ ...base, id: `approved:${v._id}`, kind: "minutes_approved", actorId: v.approvedById }, v.approvedAt);
                    }
                    if (v.status === MinutesVersionStatus.DRAFT && v.rejectedAt && v.rejectedById !== userId) {
                        push(
                            { ...base, id: `rejected:${v._id}:${new Date(v.rejectedAt).getTime()}`, kind: "minutes_rejected", detail: v.rejectedReason, actorId: v.rejectedById },
                            v.rejectedAt,
                        );
                    }
                }
                if (v.status === MinutesVersionStatus.PENDING_APPROVAL && canApprove) {
                    push({ ...base, id: `pending:${v._id}`, kind: "minutes_pending", actorId: v.recordedById }, updatedAtOf(v));
                }
            }
        }

        const actorIds = [...new Set(items.map((i) => i.actorId).filter(Boolean))];
        const actors = actorIds.length
            ? await this.userService.getMany(null, { _id: { $in: actorIds } }, { enableDataPartition: false })
            : [];
        const nameOf = new Map(actors.map((u) => [u._id, u.fullname || u.username]));
        const seenAt = membership?.notificationsSeenAt ? new Date(membership.notificationsSeenAt).getTime() : 0;
        const sorted = items
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, 50)
            .map(({ actorId, ...item }) => ({ ...item, actorName: actorId ? nameOf.get(actorId) : undefined }));
        return {
            items: sorted,
            unread: sorted.filter((i) => new Date(i.at).getTime() > seenAt).length,
        };
    }

    /** Mở chuông: mọi thông báo đến lúc này coi như đã đọc. */
    async markNotificationsSeen(userId: string, workspaceId: string) {
        await this.permissionService.assert(userId, workspaceId, Permission.WORKSPACE_VIEW);
        const membership = await this.workspaceMemberService.getOne(null, { workspaceId, userId });
        if (membership) {
            await this.workspaceMemberService.updateById(null, membership._id, {
                notificationsSeenAt: new Date(),
            });
        }
    }

    async getMeetings(userId: string, workspaceId: string, projectId?: string) {
        return (await this.visibleMeetings(userId, workspaceId, projectId)).meetings;
    }

    /**
     * Cuộc họp người này xem được, kèm trạng thái theo góc nhìn của họ: biên
     * bản và job của bản ghi mình xem được (MeetingRecordService), không phải
     * của bản ghi riêng người khác.
     */
    private async visibleMeetings(userId: string, workspaceId: string, projectId?: string) {
        await this.permissionService.assert(
            userId,
            workspaceId,
            Permission.WORKSPACE_VIEW,
        );
        const candidates = await this.meetingService.getMany(null, {
            workspaceId,
            deletedAt: null,
            ...(projectId ? { projectId } : {}),
        });

        const visible = await this.permissionService.filterMeetings(
            userId,
            candidates,
            [Permission.MEETING_VIEW],
        );
        const records = new Map<string, MeetingRecords>();
        if (!visible.length) return { meetings: [], records };

        const ids = visible.map((m) => m._id);
        const [minutesList, jobs, recordsOf] = await Promise.all([
            this.meetingMinutesService.getMany(null, { meetingId: { $in: ids } }),
            this.processingJobService.getMany(null, { meetingId: { $in: ids } }),
            this.meetingRecordService.recordsFor(userId, visible),
        ]);
        const hasMinutes = new Set(
            minutesList.filter((m) => m.currentVersionId).map((m) => m.meetingId),
        );
        const latest = (list: typeof jobs) =>
            list.reduce<(typeof jobs)[number] | undefined>(
                (best, job) => (!best || createdAtOf(job) > createdAtOf(best) ? job : best),
                undefined,
            );

        const meetings = visible
            .map((meeting) => {
                const view = recordsOf.get(meeting._id);
                records.set(meeting._id, view);
                const minutesStatus = MeetingRecordService.minutesStatusOf(view) as string | undefined;
                const meetingJobs = jobs.filter((j) => j.meetingId === meeting._id);
                // Job của bản ghi mình (người duyệt: mọi bản ghi).
                const job = latest(
                    meetingJobs.filter(
                        (j) => view?.seeAll || (j.payload?.recordedById ?? meeting.createdById) === userId,
                    ),
                );
                let phase = derivePhase(meeting, minutesStatus, job?.status);
                if (!minutesStatus && !job) {
                    // Chưa có bản ghi nào của mình: theo tình trạng chung của cuộc
                    // họp, nhưng không báo lỗi xử lý bản ghi của người khác.
                    const any = latest(meetingJobs);
                    phase = derivePhase(
                        meeting,
                        hasMinutes.has(meeting._id) ? MinutesVersionStatus.DRAFT : undefined,
                        any?.status === ProcessingJobStatus.FAILED ? ProcessingJobStatus.SUCCEEDED : any?.status,
                    );
                }
                return {
                    ...meeting,
                    minutesStatus,
                    latestJob: job
                        ? { type: job.type, status: job.status, error: job.error }
                        : undefined,
                    phase,
                };
            })
            .sort((a, b) => startOf(b) - startOf(a));
        return { meetings, records };
    }
}

function derivePhase(
    meeting: Meeting,
    minutesStatus: string | undefined,
    jobStatus: string | undefined,
): MeetingPhase {
    // Buổi họp trực tiếp chỉ sang "ended" khi phiên âm xong; đã có job nghĩa
    // là bản ghi đã tải lên, đang chờ hoặc đang xử lý chứ không còn "sắp tới".
    if (meeting.status === MeetingStatus.SCHEDULED && !jobStatus) return "scheduled";
    if (jobStatus === ProcessingJobStatus.FAILED) return "failed";
    if (minutesStatus === "approved") return "completed";
    if (minutesStatus) return "pending_review";
    return "processing";
}

/** Entity không khai `createdAt` nhưng bản ghi luôn có (timestamps: true). */
function createdAtOf(row: object): number {
    const at = (row as { createdAt?: Date | string }).createdAt;
    return at ? new Date(at).getTime() : 0;
}

function updatedAtOf(row: object): number {
    const at = (row as { updatedAt?: Date | string }).updatedAt;
    return at ? new Date(at).getTime() : createdAtOf(row);
}

function startOf(m: Meeting): number {
    const at = m.actualStartAt ?? m.scheduledStartAt;
    return at ? new Date(at).getTime() : createdAtOf(m);
}
