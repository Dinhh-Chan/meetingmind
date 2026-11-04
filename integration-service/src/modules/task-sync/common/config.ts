import { Configuration } from "@config/configuration";
import { Logger, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const TASK_SYNC_CONFIG = "TASK_SYNC_CONFIG";

export const DEFAULT_TRELLO_LIST_NAME = "Việc từ cuộc họp";

export interface TrelloConfig {
    apiKey: string;
    token: string;
    /** List nhận thẻ. Không có thì tìm/tạo list `listName` trên `boardId`. */
    listId?: string;
    boardId?: string;
    listName: string;
}

export interface TelegramConfig {
    botToken: string;
    /** Không có thì dò bằng getUpdates (chat gần nhất nhắn cho bot). */
    chatId?: string;
}

/**
 * Cấu hình đồng bộ, đọc từ env. MVP: mỗi nhà cung cấp một kết nối dùng chung
 * cho mọi workspace. `null` nghĩa là thiếu thông tin đăng nhập — nhà cung cấp
 * đó bị bỏ qua (skipped), không phải lỗi.
 */
export interface TaskSyncConfig {
    trello: TrelloConfig | null;
    telegram: TelegramConfig | null;
}

const clean = (value?: string) => value?.trim() || undefined;

export function buildTaskSyncConfig(
    trello: Partial<Configuration["trello"]> = {},
    telegram: Partial<Configuration["telegram"]> = {},
    logger?: Logger,
): TaskSyncConfig {
    const apiKey = clean(trello.apiKey);
    const token = clean(trello.token);
    // Có một nửa thì gần như chắc là quên điền nửa kia: báo ra cho dễ thấy.
    if (Boolean(apiKey) !== Boolean(token)) {
        logger?.warn(
            "Trello cần cả TRELLO_API_KEY và TRELLO_TOKEN; đang thiếu một trong hai nên bỏ qua Trello",
        );
    }
    const botToken = clean(telegram.botToken);
    return {
        trello:
            apiKey && token
                ? {
                      apiKey,
                      token,
                      listId: clean(trello.listId),
                      boardId: clean(trello.boardId),
                      listName:
                          clean(trello.listName) ?? DEFAULT_TRELLO_LIST_NAME,
                  }
                : null,
        telegram: botToken
            ? { botToken, chatId: clean(telegram.chatId) }
            : null,
    };
}

/** Các chuỗi bí mật, để xoá khỏi mọi thông báo lỗi trước khi ghi log/DB/event. */
export function getSecrets(config: TaskSyncConfig): string[] {
    return [
        config.trello?.apiKey,
        config.trello?.token,
        config.telegram?.botToken,
    ].filter(Boolean);
}

export const TaskSyncConfigProvider: Provider = {
    provide: TASK_SYNC_CONFIG,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<Configuration>) =>
        buildTaskSyncConfig(
            configService.get("trello", { infer: true }),
            configService.get("telegram", { infer: true }),
            new Logger("TaskSyncConfig"),
        ),
};
