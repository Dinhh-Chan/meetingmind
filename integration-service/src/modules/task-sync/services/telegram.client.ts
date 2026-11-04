import { Inject, Injectable } from "@nestjs/common";
import { TASK_SYNC_CONFIG, TaskSyncConfig } from "../common/config";
import { ProviderError, shortDetail } from "../common/provider-error";
import { HttpClient, HttpRequestOptions } from "./http-client.service";

const TELEGRAM_API = "https://api.telegram.org";

interface TelegramChat {
    id: number | string;
}

interface TelegramUpdate {
    update_id: number;
    message?: { chat: TelegramChat };
    edited_message?: { chat: TelegramChat };
    channel_post?: { chat: TelegramChat };
    my_chat_member?: { chat: TelegramChat };
}

interface TelegramResponse<T> {
    ok: boolean;
    result?: T;
    error_code?: number;
    description?: string;
}

/** Gọi Telegram Bot API. Token nằm trên đường dẫn nên không bao giờ log URL. */
@Injectable()
export class TelegramClient {
    constructor(
        private readonly http: HttpClient,
        @Inject(TASK_SYNC_CONFIG) private readonly config: TaskSyncConfig,
    ) {}

    /**
     * Chat gần nhất đã nhắn cho bot, null nếu chưa ai nhắn. Chỉ là đường lùi
     * khi thiếu TELEGRAM_CHAT_ID: token có thể dùng chung với ứng dụng khác
     * đang long-poll getUpdates. Telegram chỉ giữ update 24 giờ nên người gọi
     * phải lưu lại kết quả.
     */
    async discoverChatId(): Promise<string | null> {
        // Không truyền offset: offset (kể cả số âm) xác nhận các update cũ,
        // ứng dụng khác dùng chung bot sẽ mất tin.
        const updates = await this.call<TelegramUpdate[]>("getUpdates", {
            query: { limit: 100, timeout: 0 },
        });
        for (let i = (updates ?? []).length - 1; i >= 0; i--) {
            const update = updates[i];
            const chat =
                update.message?.chat ??
                update.edited_message?.chat ??
                update.channel_post?.chat ??
                update.my_chat_member?.chat;
            if (chat?.id !== undefined && chat?.id !== null) {
                return String(chat.id);
            }
        }
        return null;
    }

    async sendMessage(
        chatId: string,
        html: string,
    ): Promise<{ messageId: string }> {
        const message = await this.call<{ message_id: number }>("sendMessage", {
            method: "POST",
            body: {
                chat_id: chatId,
                text: html,
                parse_mode: "HTML",
                link_preview_options: { is_disabled: true },
            },
        });
        return { messageId: String(message?.message_id) };
    }

    private async call<T>(
        method: string,
        options: HttpRequestOptions = {},
    ): Promise<T> {
        if (!this.config.telegram) {
            throw new ProviderError("Chưa cấu hình Telegram");
        }
        const res = await this.http.request<TelegramResponse<T>>(
            `${TELEGRAM_API}/bot${this.config.telegram.botToken}/${method}`,
            options,
        );
        if (!res.data?.ok) {
            const code = res.data?.error_code ?? res.status;
            const detail = res.data?.description ?? shortDetail(res.data);
            throw new ProviderError(
                `Telegram trả lỗi ${code} (${method}): ${detail}`,
            );
        }
        return res.data.result;
    }
}
