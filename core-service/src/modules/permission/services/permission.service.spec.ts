import { MeetingAccessScope } from "@module/meeting/common/constant";
import { ProjectMemberRole } from "@module/project-member/common/constant";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "@module/workspace-member/common/constant";
import { Permission } from "../common/constant";
import { PermissionService } from "./permission.service";

jest.mock("p-limit", () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));

/**
 * QA: chỉ người thuộc cuộc họp mới thấy cuộc họp của dự án; PM và Owner/Admin
 * vẫn thấy để duyệt; khách dự họp chỉ xem biên bản.
 */
describe("PermissionService — cuộc họp trong dự án", () => {
    const meeting = {
        _id: "m1",
        workspaceId: "w1",
        projectId: "p1",
        createdById: "creator",
        accessScope: MeetingAccessScope.PROJECT,
    };

    function setup(input: {
        workspace: Record<string, WorkspaceMemberRole>;
        project?: Record<string, ProjectMemberRole>;
        participants?: string[];
        approverId?: string;
    }) {
        const service = new PermissionService(
            {
                getOne: async (_: unknown, c: { userId: string }) =>
                    input.workspace[c.userId]
                        ? { role: input.workspace[c.userId], status: WorkspaceMemberStatus.ACTIVE }
                        : null,
            } as any,
            {
                // Tra vai trò của một người, hoặc tìm PM của dự án.
                getOne: async (_: unknown, c: { userId?: string; role?: ProjectMemberRole }) => {
                    if (c.userId) return input.project?.[c.userId] ? { role: input.project[c.userId] } : null;
                    const pm = Object.entries(input.project ?? {}).find(([, role]) => role === c.role);
                    return pm ? { userId: pm[0], role: pm[1] } : null;
                },
            } as any,
            { getOne: async () => null } as any,
            { getOne: async () => ({ ...meeting, approverId: input.approverId }) } as any,
            {
                getOne: async (_: unknown, c: { userId: string }) =>
                    (input.participants ?? []).includes(c.userId) ? { userId: c.userId } : null,
            } as any,
        );
        return (userId: string, permission: Permission) =>
            service.canOnMeeting(userId, { ...meeting, approverId: input.approverId } as any, permission);
    }

    const members = {
        workspace: {
            alice: WorkspaceMemberRole.MEMBER,
            bob: WorkspaceMemberRole.MEMBER,
            creator: WorkspaceMemberRole.MEMBER,
            pm: WorkspaceMemberRole.MEMBER,
            admin: WorkspaceMemberRole.ADMIN,
            guest: WorkspaceMemberRole.MEMBER,
        },
        project: {
            alice: ProjectMemberRole.MEMBER,
            bob: ProjectMemberRole.MEMBER,
            creator: ProjectMemberRole.MEMBER,
            pm: ProjectMemberRole.PM,
        },
        participants: ["alice", "guest"],
    };

    it("thành viên dự án không dự cuộc họp thì không thấy cuộc họp", async () => {
        const can = setup(members);
        expect(await can("bob", Permission.MEETING_VIEW)).toBe(false);
        expect(await can("bob", Permission.TRANSCRIPT_VIEW)).toBe(false);
        expect(await can("bob", Permission.RECORDING_CREATE)).toBe(false);
    });

    it("người tham dự và người tạo xem, ghi âm được", async () => {
        const can = setup(members);
        for (const who of ["alice", "creator"]) {
            expect(await can(who, Permission.MEETING_VIEW)).toBe(true);
            expect(await can(who, Permission.TRANSCRIPT_VIEW)).toBe(true);
            expect(await can(who, Permission.RECORDING_CREATE)).toBe(true);
        }
    });

    it("PM và Admin workspace vẫn thấy mọi cuộc họp của dự án để duyệt", async () => {
        const can = setup(members);
        for (const who of ["pm", "admin"]) {
            expect(await can(who, Permission.MEETING_VIEW)).toBe(true);
            expect(await can(who, Permission.MINUTES_APPROVE)).toBe(true);
        }
    });

    it("khách dự họp (không thuộc dự án) chỉ xem cuộc họp và biên bản đã duyệt", async () => {
        const can = setup(members);
        expect(await can("guest", Permission.MEETING_VIEW)).toBe(true);
        expect(await can("guest", Permission.MINUTES_VIEW_APPROVED)).toBe(true);
        expect(await can("guest", Permission.TRANSCRIPT_VIEW)).toBe(false);
        expect(await can("guest", Permission.AUDIO_LISTEN)).toBe(false);
        expect(await can("guest", Permission.RECORDING_CREATE)).toBe(false);
    });

    it("người duyệt được chọn duyệt biên bản và đề xuất của cuộc họp; người dự khác thì không", async () => {
        const can = setup({ ...members, approverId: "alice" });
        expect(await can("alice", Permission.MINUTES_APPROVE)).toBe(true);
        expect(await can("alice", Permission.REVIEW_APPROVE)).toBe(true);
        expect(await can("creator", Permission.REVIEW_APPROVE)).toBe(false);
        expect(await can("bob", Permission.REVIEW_APPROVE)).toBe(false);
    });

    it("dự án chưa có PM và chưa chọn người duyệt thì người tạo cuộc họp duyệt", async () => {
        const noPm = { ...members, project: { alice: ProjectMemberRole.MEMBER, creator: ProjectMemberRole.MEMBER } };
        const can = setup(noPm);
        expect(await can("creator", Permission.REVIEW_APPROVE)).toBe(true);
        expect(await can("creator", Permission.MINUTES_APPROVE)).toBe(true);
        expect(await can("alice", Permission.REVIEW_APPROVE)).toBe(false);
        // Có PM thì người tạo không tự duyệt.
        expect(await setup(members)("creator", Permission.REVIEW_APPROVE)).toBe(false);
    });
});
