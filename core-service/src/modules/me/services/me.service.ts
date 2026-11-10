import { ActionItemService } from "@module/action-item/services/action-item.service";
import { ReviewBatchService } from "@module/review-batch/services/review-batch.service";
import { ReviewItemService } from "@module/review-item/services/review-item.service";
import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { MeetingStatus } from "@module/meeting/common/constant";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { MinutesVersionService } from "@module/minutes-version/services/minutes-version.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { ProcessingJobStatus } from "@module/processing-job/common/constant";
import { ProcessingJobService } from "@module/processing-job/services/processing-job.service";
import { ProjectService } from "@module/project/services/project.service";
import { UserService } from "@module/user/service/user.service";
import { WorkspaceMemberStatus } from "@module/workspace-member/common/constant";
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
        private readonly workspaceService: WorkspaceService,
        private readonly workspaceMemberService: WorkspaceMemberService,
        private readonly projectService: ProjectService,
        private readonly meetingService: MeetingService,
        private readonly meetingMinutesService: MeetingMinutesService,
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
            visible.push({ ...project, myRole });
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
    async getReviewItems(userId: string, workspaceId: string) {
        const meetings = await this.getMeetings(userId, workspaceId);
        if (!meetings.length) return [];
        const batches = await this.reviewBatchService.getMany(null, {
            meetingId: { $in: meetings.map((m) => m._id) },
        });
        const latest = new Map<string, (typeof batches)[number]>();
        for (const batch of batches) {
            const prev = latest.get(batch.meetingId);
            if (!prev || createdAtOf(batch) > createdAtOf(prev)) {
                latest.set(batch.meetingId, batch);
            }
        }
        const batchIds = [...latest.values()].map((b) => b._id);
        if (!batchIds.length) return [];
        const meetingOf = new Map(
            [...latest.values()].map((b) => [b._id, b.meetingId]),
        );
        const items = await this.reviewItemService.getMany(null, {
            reviewBatchId: { $in: batchIds },
        });
        return items.map((i) => ({
            ...i,
            meetingId: meetingOf.get(i.reviewBatchId),
        }));
    }

    async getMeetings(userId: string, workspaceId: string, projectId?: string) {
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
        if (!visible.length) return [];

        const ids = visible.map((m) => m._id);
        const [minutesList, jobs] = await Promise.all([
            this.meetingMinutesService.getMany(null, { meetingId: { $in: ids } }),
            this.processingJobService.getMany(null, { meetingId: { $in: ids } }),
        ]);
        const versionIds = minutesList
            .map((m) => m.currentVersionId)
            .filter(Boolean);
        const versions = versionIds.length
            ? await this.minutesVersionService.getMany(null, {
                  _id: { $in: versionIds },
              })
            : [];

        const versionOf = new Map(versions.map((v) => [v._id, v]));
        const minutesStatusOf = new Map(
            minutesList.map((m) => [
                m.meetingId,
                versionOf.get(m.currentVersionId)?.status as string | undefined,
            ]),
        );
        const latestJobOf = new Map<string, (typeof jobs)[number]>();
        for (const job of jobs) {
            const prev = latestJobOf.get(job.meetingId);
            if (!prev || createdAtOf(job) > createdAtOf(prev)) {
                latestJobOf.set(job.meetingId, job);
            }
        }

        return visible
            .map((meeting) => {
                const minutesStatus = minutesStatusOf.get(meeting._id);
                const job = latestJobOf.get(meeting._id);
                return {
                    ...meeting,
                    minutesStatus,
                    latestJob: job
                        ? { type: job.type, status: job.status, error: job.error }
                        : undefined,
                    phase: derivePhase(meeting, minutesStatus, job?.status),
                };
            })
            .sort((a, b) => startOf(b) - startOf(a));
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

function startOf(m: Meeting): number {
    const at = m.actualStartAt ?? m.scheduledStartAt;
    return at ? new Date(at).getTime() : createdAtOf(m);
}
