import { MeetingAccessRole } from "@module/meeting-access/common/constant";
import { ProjectMemberRole } from "@module/project-member/common/constant";
import { WorkspaceMemberRole } from "@module/workspace-member/common/constant";

/**
 * Danh mục quyền. Tên theo dạng `<tài nguyên>.<hành động>`.
 *
 * Quyền được cấp theo **phạm vi**: workspace, project, hoặc meeting độc lập.
 * Một quyền có thể xuất hiện ở nhiều phạm vi — ví dụ `MEETING_UPDATE` cấp cho
 * PM của project, và cấp cho MANAGER của meeting không thuộc project.
 */
export enum Permission {
    /* --------------------------------------------------------- workspace */
    WORKSPACE_VIEW = "workspace.view",
    WORKSPACE_SETTINGS_UPDATE = "workspace.settings.update",
    WORKSPACE_MEMBER_INVITE = "workspace.member.invite",
    WORKSPACE_MEMBER_MANAGE = "workspace.member.manage",
    WORKSPACE_ADMIN_MANAGE = "workspace.admin.manage",
    WORKSPACE_OWNERSHIP_TRANSFER = "workspace.ownership.transfer",
    WORKSPACE_BILLING_MANAGE = "workspace.billing.manage",
    WORKSPACE_AUDIT_VIEW = "workspace.audit.view",
    WORKSPACE_DELETE = "workspace.delete",

    /* ----------------------------------------------------------- project */
    PROJECT_CREATE = "project.create",
    PROJECT_VIEW = "project.view",
    PROJECT_UPDATE = "project.update",
    PROJECT_ARCHIVE = "project.archive",
    PROJECT_DELETE = "project.delete",
    PROJECT_MEMBER_MANAGE = "project.member.manage",
    PROJECT_PM_MANAGE = "project.pm.manage",

    /* ----------------------------------------------------------- meeting */
    MEETING_VIEW = "meeting.view",
    MEETING_CREATE = "meeting.create",
    MEETING_UPDATE = "meeting.update",
    MEETING_RECORDING_CONTROL = "meeting.recording.control",
    MEETING_DELETE = "meeting.delete",
    AUDIO_LISTEN = "audio.listen",
    AUDIO_DOWNLOAD = "audio.download",

    /* -------------------------------------------------------- transcript */
    TRANSCRIPT_VIEW = "transcript.view",
    TRANSCRIPT_UPDATE = "transcript.update",
    AI_RERUN = "ai.rerun",

    /* --------------------------------------------------- minutes, review */
    MINUTES_VIEW_APPROVED = "minutes.view.approved",
    MINUTES_VIEW_DRAFT = "minutes.view.draft",
    MINUTES_UPDATE_DRAFT = "minutes.update.draft",
    MINUTES_APPROVE = "minutes.approve",
    MINUTES_EXPORT_FILE = "minutes.export.file",
    MINUTES_EXPORT_EXTERNAL = "minutes.export.external",
    REVIEW_UPDATE = "review.update",
    REVIEW_APPROVE = "review.approve",

    /* -------------------------------------------------------------- task */
    TASK_VIEW = "task.view",
    TASK_CREATE = "task.create",
    TASK_ASSIGN = "task.assign",
    TASK_UPDATE = "task.update",
    TASK_SCHEDULE_UPDATE = "task.schedule.update",
    TASK_STATUS_UPDATE = "task.status.update",
    TASK_DELETE = "task.delete",
    TASK_COMMENT_CREATE = "task.comment.create",
    TASK_COMMENT_MODERATE = "task.comment.moderate",

    /* ------------------------------------------------------- integration */
    INTEGRATION_PERSONAL_MANAGE = "integration.personal.manage",
    INTEGRATION_MANAGE = "integration.manage",
    INTEGRATION_TARGET_CONFIGURE = "integration.target.configure",
    SYNC_REQUEST = "sync.request",
    SYNC_STATUS_VIEW = "sync.status.view",
    SYNC_ERROR_VIEW = "sync.error.view",

    /* ------------------------------------------------------- chat & risk */
    CHAT_QUERY = "chat.query",
    RISK_VIEW_PROJECT = "risk.view.project",
    RISK_VIEW_OWN = "risk.view.own",
    RISK_RESOLVE = "risk.resolve",
    RISK_RULE_CONFIGURE = "risk.rule.configure",
}

/**
 * Quyền mà **không ai** có được qua vai trò — kể cả Owner và SUPER_ADMIN.
 * Muốn cấp phải có cơ chế riêng, có thời hạn và ghi audit.
 */
export const NEVER_GRANTED_BY_ROLE: readonly string[] = [
    "chat.read.others",
    "calendar.read.others",
    "integration.secret.read",
];

/** Quyền theo vai trò trong workspace. Vai trò cao kế thừa vai trò thấp. */
export const WORKSPACE_ROLE_PERMISSIONS: Record<
    WorkspaceMemberRole,
    Permission[]
> = {
    [WorkspaceMemberRole.VIEWER]: [
        Permission.WORKSPACE_VIEW,
        Permission.CHAT_QUERY,
    ],
    [WorkspaceMemberRole.MEMBER]: [
        Permission.WORKSPACE_VIEW,
        Permission.CHAT_QUERY,
        Permission.INTEGRATION_PERSONAL_MANAGE,
    ],
    [WorkspaceMemberRole.ADMIN]: [
        Permission.WORKSPACE_VIEW,
        Permission.CHAT_QUERY,
        Permission.INTEGRATION_PERSONAL_MANAGE,
        Permission.WORKSPACE_SETTINGS_UPDATE,
        Permission.WORKSPACE_MEMBER_INVITE,
        Permission.WORKSPACE_MEMBER_MANAGE,
        Permission.WORKSPACE_AUDIT_VIEW,
        Permission.PROJECT_CREATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_PM_MANAGE,
        Permission.INTEGRATION_MANAGE,
        Permission.RISK_RULE_CONFIGURE,
    ],
    [WorkspaceMemberRole.OWNER]: [
        Permission.WORKSPACE_VIEW,
        Permission.CHAT_QUERY,
        Permission.INTEGRATION_PERSONAL_MANAGE,
        Permission.WORKSPACE_SETTINGS_UPDATE,
        Permission.WORKSPACE_MEMBER_INVITE,
        Permission.WORKSPACE_MEMBER_MANAGE,
        Permission.WORKSPACE_AUDIT_VIEW,
        Permission.PROJECT_CREATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_PM_MANAGE,
        Permission.INTEGRATION_MANAGE,
        Permission.RISK_RULE_CONFIGURE,
        Permission.WORKSPACE_ADMIN_MANAGE,
        Permission.WORKSPACE_OWNERSHIP_TRANSFER,
        Permission.WORKSPACE_BILLING_MANAGE,
        Permission.WORKSPACE_DELETE,
    ],
};

/** Quyền theo vai trò trong project. */
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectMemberRole, Permission[]> =
    {
        [ProjectMemberRole.VIEWER]: [
            Permission.PROJECT_VIEW,
            Permission.MEETING_VIEW,
            Permission.AUDIO_LISTEN,
            Permission.TRANSCRIPT_VIEW,
            Permission.MINUTES_VIEW_APPROVED,
            Permission.TASK_VIEW,
            Permission.SYNC_STATUS_VIEW,
        ],
        [ProjectMemberRole.MEMBER]: [
            Permission.PROJECT_VIEW,
            Permission.MEETING_VIEW,
            Permission.AUDIO_LISTEN,
            Permission.TRANSCRIPT_VIEW,
            Permission.MINUTES_VIEW_APPROVED,
            Permission.TASK_VIEW,
            Permission.SYNC_STATUS_VIEW,
            Permission.MEETING_CREATE,
            Permission.MINUTES_VIEW_DRAFT,
            Permission.MINUTES_EXPORT_FILE,
            Permission.TASK_CREATE,
            Permission.TASK_COMMENT_CREATE,
            Permission.RISK_VIEW_OWN,
        ],
        [ProjectMemberRole.PM]: [
            Permission.PROJECT_VIEW,
            Permission.MEETING_VIEW,
            Permission.AUDIO_LISTEN,
            Permission.TRANSCRIPT_VIEW,
            Permission.MINUTES_VIEW_APPROVED,
            Permission.TASK_VIEW,
            Permission.SYNC_STATUS_VIEW,
            Permission.MEETING_CREATE,
            Permission.MINUTES_VIEW_DRAFT,
            Permission.MINUTES_EXPORT_FILE,
            Permission.TASK_CREATE,
            Permission.TASK_COMMENT_CREATE,
            Permission.RISK_VIEW_OWN,
            Permission.PROJECT_UPDATE,
            Permission.PROJECT_ARCHIVE,
            Permission.PROJECT_MEMBER_MANAGE,
            Permission.MEETING_UPDATE,
            Permission.MEETING_RECORDING_CONTROL,
            Permission.MEETING_DELETE,
            Permission.AUDIO_DOWNLOAD,
            Permission.TRANSCRIPT_UPDATE,
            Permission.AI_RERUN,
            Permission.MINUTES_UPDATE_DRAFT,
            Permission.MINUTES_APPROVE,
            Permission.MINUTES_EXPORT_EXTERNAL,
            Permission.REVIEW_UPDATE,
            Permission.REVIEW_APPROVE,
            Permission.TASK_ASSIGN,
            Permission.TASK_UPDATE,
            Permission.TASK_SCHEDULE_UPDATE,
            Permission.TASK_STATUS_UPDATE,
            Permission.TASK_DELETE,
            Permission.TASK_COMMENT_MODERATE,
            Permission.INTEGRATION_TARGET_CONFIGURE,
            Permission.SYNC_REQUEST,
            Permission.SYNC_ERROR_VIEW,
            Permission.RISK_VIEW_PROJECT,
            Permission.RISK_RESOLVE,
        ],
    };

/** Quyền trên cuộc họp không thuộc project (`accessScope = restricted`). */
export const MEETING_ACCESS_ROLE_PERMISSIONS: Record<
    MeetingAccessRole,
    Permission[]
> = {
    [MeetingAccessRole.VIEWER]: [
        Permission.MEETING_VIEW,
        Permission.AUDIO_LISTEN,
        Permission.TRANSCRIPT_VIEW,
        Permission.MINUTES_VIEW_APPROVED,
        Permission.TASK_VIEW,
    ],
    [MeetingAccessRole.EDITOR]: [
        Permission.MEETING_VIEW,
        Permission.AUDIO_LISTEN,
        Permission.TRANSCRIPT_VIEW,
        Permission.MINUTES_VIEW_APPROVED,
        Permission.TASK_VIEW,
        Permission.TRANSCRIPT_UPDATE,
        Permission.MINUTES_VIEW_DRAFT,
        Permission.MINUTES_UPDATE_DRAFT,
        Permission.REVIEW_UPDATE,
        Permission.TASK_CREATE,
        Permission.TASK_COMMENT_CREATE,
    ],
    [MeetingAccessRole.MANAGER]: [
        Permission.MEETING_VIEW,
        Permission.AUDIO_LISTEN,
        Permission.TRANSCRIPT_VIEW,
        Permission.MINUTES_VIEW_APPROVED,
        Permission.TASK_VIEW,
        Permission.TRANSCRIPT_UPDATE,
        Permission.MINUTES_VIEW_DRAFT,
        Permission.MINUTES_UPDATE_DRAFT,
        Permission.REVIEW_UPDATE,
        Permission.TASK_CREATE,
        Permission.TASK_COMMENT_CREATE,
        Permission.MEETING_UPDATE,
        Permission.MEETING_RECORDING_CONTROL,
        Permission.MEETING_DELETE,
        Permission.AUDIO_DOWNLOAD,
        Permission.AI_RERUN,
        Permission.MINUTES_APPROVE,
        Permission.REVIEW_APPROVE,
        Permission.TASK_ASSIGN,
        Permission.TASK_UPDATE,
        Permission.TASK_SCHEDULE_UPDATE,
        Permission.TASK_STATUS_UPDATE,
        Permission.TASK_DELETE,
        Permission.TASK_COMMENT_MODERATE,
    ],
};

/**
 * Owner/Admin workspace được coi như PM ở mọi project trong workspace đó
 * (chính sách MVP, xem ARCHITECTURE.md mục 6).
 */
export const WORKSPACE_ROLES_ACTING_AS_PM: readonly WorkspaceMemberRole[] = [
    WorkspaceMemberRole.OWNER,
    WorkspaceMemberRole.ADMIN,
];

/**
 * Quyền chỉ được cấp kèm điều kiện về bản ghi cụ thể. Guard ở tầng route
 * không đủ để quyết định — phải kiểm tra tiếp trong service.
 */
export enum PermissionCondition {
    /** Chỉ áp dụng cho cuộc họp do chính người đó tạo */
    OWN_MEETING = "own_meeting",
    /** Chỉ áp dụng cho task đang giao cho chính người đó */
    ASSIGNED_TASK = "assigned_task",
    /** Chỉ áp dụng cho bản ghi do chính người đó tạo */
    OWN_RECORD = "own_record",
}
