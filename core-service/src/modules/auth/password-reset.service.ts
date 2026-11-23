import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { MailService } from "@module/mail/mail.service";
import { UserService } from "@module/user/service/user.service";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";

interface ResetPayload {
    typ: "password-reset";
    sub: string;
    /** Dấu của mật khẩu lúc gửi link: đổi mật khẩu xong thì link cũ hết dùng được. */
    fp: string;
}

/** Link đặt lại mật khẩu hết hạn sau số phút này. */
const RESET_MINUTES = 30;

const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Quên mật khẩu: gửi link đặt lại qua email. Link là token ký (không cần bảng riêng),
 * có hạn và chỉ dùng được một lần nhờ gắn dấu của mật khẩu hiện tại.
 */
@Injectable()
export class PasswordResetService {
    private readonly logger = new Logger(PasswordResetService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService<Configuration>,
        private readonly mailService: MailService,
        private readonly userService: UserService,
    ) {}

    /** Khoá riêng: token đặt lại không dùng làm access token được. */
    private get secret() {
        return `${this.configService.get("jwt", { infer: true }).secret}:password-reset`;
    }

    private fingerprint(passwordHash: string | undefined | null) {
        return createHash("sha256").update(passwordHash ?? "no-password").digest("hex").slice(0, 16);
    }

    /**
     * Luôn trả như nhau dù email có tài khoản hay không, để không lộ ai có tài khoản.
     * Chỉ báo lỗi khi máy chủ chưa cấu hình gửi mail.
     */
    async requestReset(email: string) {
        if (!this.mailService.enabled) throw ApiError.BadRequest("error-mail-not-configured");
        const user = await this.userService.findForPasswordReset(email);
        if (!user?.email) return { sent: true };
        const payload: ResetPayload = { typ: "password-reset", sub: user._id, fp: this.fingerprint(user.password) };
        const token = await this.jwtService.signAsync(payload, { secret: this.secret, expiresIn: `${RESET_MINUTES}m` });
        const appUrl = this.configService.get("appUrl", { infer: true });
        const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const name = user.fullname || user.username || "bạn";
        try {
            await this.mailService.send({
                to: user.email,
                subject: "Đặt lại mật khẩu MeetingMind",
                text: [
                    `Chào ${name},`,
                    "",
                    "Có yêu cầu đặt lại mật khẩu cho tài khoản MeetingMind của bạn. Mở link sau để đặt mật khẩu mới:",
                    link,
                    "",
                    `Link có hiệu lực ${RESET_MINUTES} phút và chỉ dùng được một lần. Nếu không phải bạn, hãy bỏ qua email này.`,
                ].join("\n"),
                html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2433">
  <h2 style="color:#3B6FE5;margin-bottom:8px">MeetingMind</h2>
  <p>Chào <b>${escapeHtml(name)}</b>,</p>
  <p>Có yêu cầu đặt lại mật khẩu cho tài khoản MeetingMind của bạn.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#3B6FE5;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Đặt mật khẩu mới</a></p>
  <p style="font-size:13px;color:#6b7280">Link có hiệu lực ${RESET_MINUTES} phút và chỉ dùng được một lần. Nếu không phải bạn, hãy bỏ qua email này.</p>
</div>`,
            });
        } catch (err) {
            this.logger.warn(`Không gửi được mail đặt lại mật khẩu: ${(err as Error).message}`);
            throw ApiError.BadRequest("error-mail-send-failed");
        }
        return { sent: true };
    }

    async resetPassword(token: string, newPass: string) {
        let payload: ResetPayload;
        try {
            payload = this.jwtService.verify<ResetPayload>(token, { secret: this.secret });
            if (payload.typ !== "password-reset") throw new Error("typ");
        } catch {
            throw ApiError.BadRequest("error-reset-link-invalid");
        }
        const user = await this.userService.getForPasswordReset(payload.sub);
        if (!user || this.fingerprint(user.password) !== payload.fp) {
            throw ApiError.BadRequest("error-reset-link-invalid");
        }
        await this.userService.setPasswordFromReset(user._id, newPass);
        return { reset: true };
    }
}
