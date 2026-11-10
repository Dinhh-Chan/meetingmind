import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { MailService } from "@module/mail/mail.service";
import { UserService } from "@module/user/service/user.service";
import {
    WorkspaceMemberRole,
    WorkspaceMemberStatus,
} from "@module/workspace-member/common/constant";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { WorkspaceService } from "@module/workspace/services/workspace.service";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

interface InvitePayload {
    typ: "workspace-invite";
    ws: string;
    email: string;
    role: WorkspaceMemberRole;
    by: string;
}

/** Link mời hết hạn sau số ngày này. */
const INVITE_DAYS = 7;

const roleLabel: Record<string, string> = {
    ADMIN: "quản trị viên",
    MEMBER: "thành viên",
    VIEWER: "người xem",
};

const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Mời qua email người chưa có tài khoản. Lời mời là token ký (không cần bảng
 * riêng): người nhận mở link, đăng ký hoặc đăng nhập Google bằng đúng email
 * được mời thì vào workspace với vai trò đã chọn.
 */
@Injectable()
export class InvitationService {
    private readonly logger = new Logger(InvitationService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService<Configuration>,
        private readonly mailService: MailService,
        private readonly userService: UserService,
        private readonly workspaceService: WorkspaceService,
        private readonly workspaceMemberService: WorkspaceMemberService,
    ) {}

    /** Khoá riêng cho lời mời: token mời không dùng làm access token được. */
    private get secret() {
        return `${this.configService.get("jwt", { infer: true }).secret}:workspace-invite`;
    }

    private async userById(id: string) {
        const [user] = await this.userService.getMany(null, { _id: id }, { enableDataPartition: false });
        return user;
    }

    private async mailContext(inviterId: string, workspaceId: string) {
        const [inviter, workspace] = await Promise.all([
            this.userById(inviterId),
            this.workspaceService.getById(null, workspaceId),
        ]);
        return {
            inviterName: inviter?.fullname || inviter?.username || "Một thành viên",
            workspaceName: workspace?.name ?? "MeetingMind",
            appUrl: this.configService.get("appUrl", { infer: true }),
        };
    }

    async sendInvite(
        inviterId: string,
        workspaceId: string,
        email: string,
        role: WorkspaceMemberRole,
    ) {
        if (!this.mailService.enabled) {
            throw ApiError.BadRequest("error-mail-not-configured");
        }
        const payload: InvitePayload = { typ: "workspace-invite", ws: workspaceId, email, role, by: inviterId };
        const token = await this.jwtService.signAsync(payload, {
            secret: this.secret,
            expiresIn: `${INVITE_DAYS}d`,
        });
        const { inviterName, workspaceName, appUrl } = await this.mailContext(inviterId, workspaceId);
        const link = `${appUrl}/invite?token=${encodeURIComponent(token)}`;
        const subject = `${inviterName} mời bạn tham gia ${workspaceName} trên MeetingMind`;
        const text = [
            `${inviterName} mời bạn tham gia workspace "${workspaceName}" trên MeetingMind với vai trò ${roleLabel[role] ?? role}.`,
            "",
            `Mở link sau để tạo tài khoản hoặc đăng nhập bằng Google (dùng đúng email ${email}):`,
            link,
            "",
            `Link có hiệu lực ${INVITE_DAYS} ngày.`,
        ].join("\n");
        const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2433">
  <h2 style="color:#3B6FE5;margin-bottom:8px">MeetingMind</h2>
  <p><b>${escapeHtml(inviterName)}</b> mời bạn tham gia workspace <b>${escapeHtml(workspaceName)}</b> với vai trò ${escapeHtml(roleLabel[role] ?? role)}.</p>
  <p>Tạo tài khoản hoặc đăng nhập bằng Google, dùng đúng email <b>${escapeHtml(email)}</b>.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#3B6FE5;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Nhận lời mời</a></p>
  <p style="font-size:13px;color:#6b7280">Link có hiệu lực ${INVITE_DAYS} ngày. Nếu không phải bạn, hãy bỏ qua email này.</p>
</div>`;
        await this.mailService.send({ to: email, subject, text, html });
        return { invited: true, email };
    }

    /** Báo người đã có tài khoản là vừa được thêm vào workspace. Gửi lỗi không chặn việc thêm. */
    async notifyAdded(inviterId: string, workspaceId: string, email: string | undefined) {
        if (!this.mailService.enabled || !email) return;
        try {
            const { inviterName, workspaceName, appUrl } = await this.mailContext(inviterId, workspaceId);
            await this.mailService.send({
                to: email,
                subject: `Bạn đã được thêm vào ${workspaceName} trên MeetingMind`,
                text: `${inviterName} đã thêm bạn vào workspace "${workspaceName}". Đăng nhập: ${appUrl}/login`,
                html: `<p><b>${escapeHtml(inviterName)}</b> đã thêm bạn vào workspace <b>${escapeHtml(workspaceName)}</b> trên MeetingMind.</p><p><a href="${appUrl}/login">Đăng nhập</a></p>`,
            });
        } catch (err) {
            this.logger.warn(`Không gửi được mail báo thêm thành viên tới ${email}: ${(err as Error).message}`);
        }
    }

    verify(token: string): InvitePayload {
        try {
            const payload = this.jwtService.verify<InvitePayload>(token, { secret: this.secret });
            if (payload.typ !== "workspace-invite") throw new Error("typ");
            return payload;
        } catch {
            throw ApiError.BadRequest("error-invite-invalid");
        }
    }

    /** Thông tin cho trang /invite trước khi đăng nhập. */
    async describe(token: string) {
        const payload = this.verify(token);
        const { inviterName, workspaceName } = await this.mailContext(payload.by, payload.ws);
        return { workspaceName, inviterName, email: payload.email, role: payload.role };
    }

    /** Nhận lời mời: email của tài khoản phải trùng email được mời. */
    async accept(userId: string, token: string) {
        const payload = this.verify(token);
        const user = await this.userById(userId);
        if ((user?.email ?? "").trim().toLowerCase() !== payload.email) {
            throw ApiError.Forbidden("error-invite-email-mismatch");
        }
        const existing = await this.workspaceMemberService.getOne(null, {
            workspaceId: payload.ws,
            userId,
        });
        if (!existing) {
            await this.workspaceMemberService.create(null, {
                workspaceId: payload.ws,
                userId,
                role: payload.role,
                status: WorkspaceMemberStatus.ACTIVE,
                joinedAt: new Date(),
            });
        } else if (existing.status !== WorkspaceMemberStatus.ACTIVE) {
            await this.workspaceMemberService.updateById(null, existing._id, {
                status: WorkspaceMemberStatus.ACTIVE,
                joinedAt: new Date(),
            });
        }
        const workspace = await this.workspaceService.getById(null, payload.ws);
        return { workspaceId: payload.ws, workspaceName: workspace?.name, role: existing?.role ?? payload.role };
    }
}
