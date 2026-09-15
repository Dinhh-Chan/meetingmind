/**
 * Đợt 3: áp ma trận phân quyền.
 * - workspace_members: bỏ PM, thêm ADMIN
 * - meetings: bỏ visibility, dùng accessScope
 * - meeting_access: bảng mới cho meeting không thuộc project
 */

const S = (name, opt = {}) => ({ name, type: "string", ...opt });
const T = (name, opt = {}) => ({ name, type: "text", ...opt });
const D = (name, opt = {}) => ({ name, type: "date", ...opt });

const WS = { name: "workspaceId", type: "string", required: true, label: "Workspace" };

module.exports = [
    {
        name: "workspace-member",
        table: "workspace_members",
        enums: {
            WorkspaceMemberRole: {
                OWNER: "OWNER",
                ADMIN: "ADMIN",
                MEMBER: "MEMBER",
                VIEWER: "VIEWER",
            },
            WorkspaceMemberStatus: {
                ACTIVE: "active",
                INVITED: "invited",
                DISABLED: "disabled",
            },
        },
        indexes: [{ fields: ["workspaceId", "userId"], unique: true }],
        fields: [
            WS,
            S("userId", { required: true, label: "Người dùng" }),
            S("role", { required: true, label: "Vai trò", enum: "WorkspaceMemberRole" }),
            S("status", { required: true, label: "Trạng thái", enum: "WorkspaceMemberStatus" }),
            D("joinedAt", { label: "Thời điểm tham gia" }),
        ],
    },
    {
        name: "meeting-access",
        table: "meeting_access",
        enums: {
            MeetingAccessRole: {
                MANAGER: "MANAGER",
                EDITOR: "EDITOR",
                VIEWER: "VIEWER",
            },
        },
        indexes: [
            { fields: ["meetingId", "userId"], unique: true },
            { fields: ["workspaceId", "userId"] },
        ],
        fields: [
            WS,
            S("meetingId", { required: true, label: "Cuộc họp" }),
            S("userId", { required: true, label: "Người dùng" }),
            S("role", { required: true, label: "Vai trò trên cuộc họp", enum: "MeetingAccessRole" }),
            S("grantedById", { label: "Người cấp quyền" }),
        ],
    },
    {
        name: "meeting",
        table: "meetings",
        softDelete: true,
        enums: {
            MeetingSourceType: {
                MEETING_LINK: "meeting_link",
                IN_PERSON: "in_person",
                UPLOAD: "upload",
            },
            MeetingPlatform: {
                GOOGLE_MEET: "google_meet",
                TEAMS: "teams",
                ZOOM: "zoom",
                OTHER: "other",
            },
            MeetingAccessScope: {
                PROJECT: "project",
                RESTRICTED: "restricted",
            },
            MeetingStatus: {
                SCHEDULED: "scheduled",
                IN_PROGRESS: "in_progress",
                ENDED: "ended",
                CANCELLED: "cancelled",
            },
            ProcessingStatus: {
                PENDING: "pending",
                TRANSCRIBING: "transcribing",
                SUMMARIZING: "summarizing",
                INDEXING: "indexing",
                DONE: "done",
                FAILED: "failed",
            },
        },
        indexes: [
            { fields: ["workspaceId", "scheduledStartAt"] },
            { fields: ["workspaceId", "projectId"] },
            { fields: ["workspaceId", "status"] },
        ],
        fields: [
            WS,
            S("projectId", { label: "Dự án" }),
            S("title", { required: true, label: "Tiêu đề" }),
            T("description", { label: "Mô tả" }),
            S("sourceType", { required: true, label: "Nguồn cuộc họp", enum: "MeetingSourceType" }),
            T("meetingUrl", { label: "Link phòng họp (chỉ với nguồn meeting_link)" }),
            S("platform", { label: "Nền tảng", enum: "MeetingPlatform" }),
            S("language", { required: true, label: "Ngôn ngữ" }),
            S("accessScope", {
                required: true,
                label: "Phạm vi truy cập",
                enum: "MeetingAccessScope",
            }),
            S("status", { required: true, label: "Trạng thái", enum: "MeetingStatus" }),
            D("scheduledStartAt", { label: "Thời gian bắt đầu dự kiến" }),
            D("scheduledEndAt", { label: "Thời gian kết thúc dự kiến" }),
            D("actualStartAt", { label: "Thời gian bắt đầu thực tế" }),
            D("actualEndAt", { label: "Thời gian kết thúc thực tế" }),
            S("processingStatus", { label: "Trạng thái xử lý (tổng hợp)", enum: "ProcessingStatus" }),
            S("createdById", { required: true, label: "Người tạo" }),
        ],
    },
];
