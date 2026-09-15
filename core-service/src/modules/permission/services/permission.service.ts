import { ApiError } from "@config/exception/api-error";
import { MeetingAccessRole } from "@module/meeting-access/common/constant";
import { MeetingAccessService } from "@module/meeting-access/services/meeting-access.service";
import { MeetingAccessScope } from "@module/meeting/common/constant";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MeetingService } from "@module/meeting/services/meeting.service";
import { ProjectMemberRole } from "@module/project-member/common/constant";
import { ProjectMemberService } from "@module/project-member/services/project-member.service";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "@module/workspace-member/common/constant";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { Injectable } from "@nestjs/common";
import {
    MEETING_ACCESS_ROLE_PERMISSIONS,
    Permission,
    PROJECT_ROLE_PERMISSIONS,
    WORKSPACE_ROLE_PERMISSIONS,
    WORKSPACE_ROLES_ACTING_AS_PM,
} from "../common/constant";

export interface PermissionScope {
    projectId?: string;
    meetingId?: string;
}

/**
 * Quyền mà thành viên project được thực hiện trên **cuộc họp do chính mình tạo**,
 * dù vai trò project của họ không có sẵn quyền đó.
 * Theo ma trận phân quyền mục 4 và 5.
 */
const OWN_MEETING_PERMISSIONS: readonly Permission[] = [
    Permission.MEETING_UPDATE,
    Permission.MEETING_RECORDING_CONTROL,
    Permission.TRANSCRIPT_UPDATE,
    Permission.MINUTES_UPDATE_DRAFT,
    Permission.REVIEW_UPDATE,
];

/** Quyền trên task đang giao cho chính mình. Ma trận mục 6. */
const ASSIGNED_TASK_PERMISSIONS: readonly Permission[] = [
    Permission.TASK_UPDATE,
    Permission.TASK_STATUS_UPDATE,
];

/**
 * Nơi duy nhất quyết định quyền nghiệp vụ.
 *
 * Gateway chỉ kiểm token; AI và Integration hỏi qua API nội bộ của Core.
 * Xem ARCHITECTURE.md mục 6.
 */
@Injectable()
export class PermissionService {
    constructor(
        private readonly workspaceMemberService: WorkspaceMemberService,
        private readonly projectMemberService: ProjectMemberService,
        private readonly meetingAccessService: MeetingAccessService,
        private readonly meetingService: MeetingService,
    ) {}

    /** Vai trò workspace, chỉ tính membership `active`. `invited` chưa có quyền. */
    async getWorkspaceRole(
        userId: string,
        workspaceId: string,
    ): Promise<WorkspaceMemberRole | null> {
        const member = await this.workspaceMemberService.getOne(null, {
            workspaceId,
            userId,
            status: WorkspaceMemberStatus.ACTIVE,
        });
        return (member?.role as WorkspaceMemberRole) ?? null;
    }

    async getProjectRole(
        userId: string,
        workspaceId: string,
        projectId: string,
    ): Promise<ProjectMemberRole | null> {
        const member = await this.projectMemberService.getOne(null, {
            workspaceId,
            projectId,
            userId,
        });
        return (member?.role as ProjectMemberRole) ?? null;
    }

    async getMeetingAccessRole(
        userId: string,
        meetingId: string,
    ): Promise<MeetingAccessRole | null> {
        const access = await this.meetingAccessService.getOne(null, {
            meetingId,
            userId,
        });
        return (access?.role as MeetingAccessRole) ?? null;
    }

    /**
     * Tập quyền hiệu lực của một người trong phạm vi đã cho.
     *
     * Thứ tự theo quy tắc kết hợp: membership active -> tài nguyên đúng
     * workspace -> vai trò project/meeting -> quyền.
     */
    async resolve(
        userId: string,
        workspaceId: string,
        scope: PermissionScope = {},
    ): Promise<Set<Permission>> {
        const granted = new Set<Permission>();
        if (!userId || !workspaceId) {
            return granted;
        }

        const workspaceRole = await this.getWorkspaceRole(userId, workspaceId);
        if (!workspaceRole) {
            // Không phải thành viên active thì không có quyền nào, kể cả khi
            // còn bản ghi project_members cũ.
            return granted;
        }
        WORKSPACE_ROLE_PERMISSIONS[workspaceRole].forEach((p) => granted.add(p));

        let { projectId } = scope;
        let meeting: Meeting | null = null;

        if (scope.meetingId) {
            meeting = await this.meetingService.getOne(null, {
                _id: scope.meetingId,
                workspaceId,
            });
            if (!meeting) {
                // Cuộc họp không thuộc workspace đang xét -> không nới quyền.
                return granted;
            }
            projectId = projectId || meeting.projectId;
        }

        const actsAsPm = WORKSPACE_ROLES_ACTING_AS_PM.includes(workspaceRole);

        if (projectId) {
            const projectRole = actsAsPm
                ? ProjectMemberRole.PM
                : await this.getProjectRole(userId, workspaceId, projectId);
            if (projectRole) {
                PROJECT_ROLE_PERMISSIONS[projectRole].forEach((p) =>
                    granted.add(p),
                );
            }
        }

        if (meeting && meeting.accessScope === MeetingAccessScope.RESTRICTED) {
            const meetingRole = actsAsPm
                ? MeetingAccessRole.MANAGER
                : await this.getMeetingAccessRole(userId, meeting._id);
            if (meetingRole) {
                MEETING_ACCESS_ROLE_PERMISSIONS[meetingRole].forEach((p) =>
                    granted.add(p),
                );
            }
        }

        return granted;
    }

    async can(
        userId: string,
        workspaceId: string,
        permission: Permission,
        scope: PermissionScope = {},
    ): Promise<boolean> {
        const granted = await this.resolve(userId, workspaceId, scope);
        return granted.has(permission);
    }

    async assert(
        userId: string,
        workspaceId: string,
        permission: Permission,
        scope: PermissionScope = {},
    ): Promise<void> {
        if (!(await this.can(userId, workspaceId, permission, scope))) {
            throw ApiError.Forbidden("error-forbidden");
        }
    }

    /**
     * Quyền trên một cuộc họp cụ thể, có xét điều kiện "cuộc họp mình tạo".
     *
     * Điều kiện này chỉ còn hiệu lực khi người đó vẫn truy cập được project —
     * kiểm tra bằng `MEETING_VIEW` chứ không chỉ so `createdById`.
     */
    async canOnMeeting(
        userId: string,
        meeting: Pick<Meeting, "_id" | "workspaceId" | "projectId" | "createdById">,
        permission: Permission,
    ): Promise<boolean> {
        const granted = await this.resolve(userId, meeting.workspaceId, {
            meetingId: meeting._id,
            projectId: meeting.projectId,
        });
        if (granted.has(permission)) {
            return true;
        }
        return (
            meeting.createdById === userId &&
            granted.has(Permission.MEETING_VIEW) &&
            OWN_MEETING_PERMISSIONS.includes(permission)
        );
    }

    async assertOnMeeting(
        userId: string,
        meeting: Pick<Meeting, "_id" | "workspaceId" | "projectId" | "createdById">,
        permission: Permission,
    ): Promise<void> {
        if (!(await this.canOnMeeting(userId, meeting, permission))) {
            throw ApiError.Forbidden("error-forbidden");
        }
    }

    /**
     * Quyền trên một task cụ thể, có xét điều kiện "task được giao cho mình".
     *
     * Tạo task không đem lại quyền sửa vĩnh viễn sau khi task đã giao cho
     * người khác, nên chỉ xét `assigneeId`, không xét `createdById`.
     */
    async canOnTask(
        userId: string,
        task: {
            workspaceId: string;
            projectId?: string;
            meetingId?: string;
            assigneeId?: string;
        },
        permission: Permission,
    ): Promise<boolean> {
        const granted = await this.resolve(userId, task.workspaceId, {
            projectId: task.projectId,
            meetingId: task.meetingId,
        });
        if (granted.has(permission)) {
            return true;
        }
        return (
            task.assigneeId === userId &&
            granted.has(Permission.TASK_VIEW) &&
            ASSIGNED_TASK_PERMISSIONS.includes(permission)
        );
    }

    async assertOnTask(
        userId: string,
        task: {
            workspaceId: string;
            projectId?: string;
            meetingId?: string;
            assigneeId?: string;
        },
        permission: Permission,
    ): Promise<void> {
        if (!(await this.canOnTask(userId, task, permission))) {
            throw ApiError.Forbidden("error-forbidden");
        }
    }
}
