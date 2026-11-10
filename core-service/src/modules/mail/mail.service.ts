import { Configuration } from "@config/configuration";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Transporter, createTransport } from "nodemailer";

export interface MailMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
}

/**
 * Gửi mail qua SMTP (mặc định Gmail, App Password). Chưa cấu hình tài khoản
 * thì `enabled` = false và nơi gọi tự chọn cách khác (báo lỗi, bỏ qua).
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: Transporter | null = null;

    constructor(private readonly configService: ConfigService<Configuration>) {}

    get enabled() {
        const { user, pass } = this.configService.get("mail", { infer: true });
        return !!user && !!pass;
    }

    private getTransporter() {
        if (!this.transporter) {
            const { user, pass, host, port, secure } = this.configService.get("mail", { infer: true });
            this.transporter = createTransport({ host, port, secure, auth: { user, pass } });
        }
        return this.transporter;
    }

    async send(message: MailMessage) {
        const { user } = this.configService.get("mail", { infer: true });
        await this.getTransporter().sendMail({
            from: `"MeetingMind" <${user}>`,
            ...message,
        });
        this.logger.log(`Đã gửi mail "${message.subject}" tới ${message.to}`);
    }
}
