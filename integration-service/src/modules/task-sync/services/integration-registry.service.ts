import {
    ENV_EXTERNAL_ACCOUNT_ID,
    ENV_WORKSPACE_ID,
    IntegrationProvider,
    IntegrationStatus,
} from "@module/integration/common/constant";
import { Integration } from "@module/integration/entities/integration.entity";
import { IntegrationService } from "@module/integration/services/integration.service";
import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
} from "@nestjs/common";
import { TASK_SYNC_CONFIG, TaskSyncConfig } from "../common/config";

type IntegrationState = Pick<
    Integration,
    "displayName" | "status" | "config" | "lastError"
>;

/**
 * Giữ dòng `integrations` ứng với cấu hình env. sync_jobs và
 * external_task_links cần integrationId nên dòng này phải có trước khi đồng bộ.
 * Không bao giờ ghi key/token vào DB: config chỉ chứa ID list/board/chat.
 */
@Injectable()
export class IntegrationRegistryService implements OnApplicationBootstrap {
    private readonly logger = new Logger(IntegrationRegistryService.name);
    private readonly rows = new Map<IntegrationProvider, Integration>();
    private syncing?: Promise<void>;

    constructor(
        @Inject(TASK_SYNC_CONFIG) private readonly config: TaskSyncConfig,
        private readonly integrationService: IntegrationService,
    ) {}

    async onApplicationBootstrap() {
        try {
            await this.syncFromEnv();
        } catch (err) {
            // Không chặn khởi động: get() sẽ thử lại khi có việc.
            this.logger.error(
                `Chưa ghi được bảng integrations: ${err?.message}`,
            );
        }
    }

    isConfigured(provider: IntegrationProvider): boolean {
        return provider === IntegrationProvider.TRELLO
            ? Boolean(this.config.trello)
            : Boolean(this.config.telegram);
    }

    async get(provider: IntegrationProvider): Promise<Integration> {
        if (!this.rows.has(provider)) {
            await this.syncFromEnv();
        }
        return this.rows.get(provider);
    }

    /** Ghi thêm thông tin dò được (list Trello, chat Telegram) vào config. */
    async updateConfig(
        provider: IntegrationProvider,
        patch: Record<string, any>,
    ): Promise<Integration> {
        const row = await this.get(provider);
        const updated = await this.integrationService.updateById(
            null,
            row._id,
            { config: { ...row.config, ...patch } },
        );
        this.rows.set(provider, updated);
        return updated;
    }

    /** Upsert một dòng cho mỗi nhà cung cấp đã cấu hình. */
    syncFromEnv(): Promise<void> {
        // Bootstrap và tin đầu tiên có thể gọi cùng lúc: chạy chung một lượt.
        this.syncing ??= this.doSync().finally(() => {
            this.syncing = undefined;
        });
        return this.syncing;
    }

    private async doSync() {
        for (const provider of Object.values(IntegrationProvider)) {
            const existing = await this.integrationService.getOne(null, {
                workspaceId: ENV_WORKSPACE_ID,
                provider,
                externalAccountId: ENV_EXTERNAL_ACCOUNT_ID,
            });
            const desired = this.describe(provider, existing);
            if (!desired) {
                this.rows.delete(provider);
                if (
                    existing &&
                    existing.status !== IntegrationStatus.DISCONNECTED
                ) {
                    await this.integrationService.updateById(
                        null,
                        existing._id,
                        { status: IntegrationStatus.DISCONNECTED },
                    );
                }
                this.logger.log(`Chưa cấu hình ${provider}, sẽ bỏ qua`);
                continue;
            }
            const row = existing
                ? await this.integrationService.updateById(
                      null,
                      existing._id,
                      desired,
                  )
                : await this.integrationService.create(null, {
                      workspaceId: ENV_WORKSPACE_ID,
                      provider,
                      externalAccountId: ENV_EXTERNAL_ACCOUNT_ID,
                      ...desired,
                  });
            this.rows.set(provider, row);
            if (desired.lastError) {
                this.logger.error(
                    `Cấu hình ${provider} lỗi: ${desired.lastError}`,
                );
            } else {
                this.logger.log(`Đã kết nối ${provider}`);
            }
        }
    }

    private describe(
        provider: IntegrationProvider,
        existing: Integration | null,
    ): IntegrationState | null {
        if (provider === IntegrationProvider.TRELLO) {
            const cfg = this.config.trello;
            if (!cfg) {
                return null;
            }
            const noTarget = !cfg.listId && !cfg.boardId;
            return {
                displayName: "Trello (cấu hình env)",
                status: noTarget
                    ? IntegrationStatus.ERROR
                    : IntegrationStatus.CONNECTED,
                config: {
                    listId: cfg.listId ?? null,
                    boardId: cfg.boardId ?? null,
                    listName: cfg.listName,
                },
                lastError: noTarget
                    ? "Thiếu TRELLO_LIST_ID hoặc TRELLO_BOARD_ID: không biết đặt thẻ vào list nào"
                    : null,
            };
        }
        const cfg = this.config.telegram;
        if (!cfg) {
            return null;
        }
        // Chat dò bằng getUpdates thì giữ lại: Telegram chỉ giữ update 24 giờ,
        // khởi động lại sau đó sẽ không dò được nữa.
        const discovered =
            existing?.config?.chatIdSource === "getUpdates"
                ? existing.config.chatId
                : undefined;
        let config: Record<string, any> = {};
        if (cfg.chatId) {
            config = { chatId: cfg.chatId, chatIdSource: "env" };
        } else if (discovered) {
            config = { chatId: discovered, chatIdSource: "getUpdates" };
        }
        return {
            displayName: "Telegram (cấu hình env)",
            status: IntegrationStatus.CONNECTED,
            config,
            lastError: null,
        };
    }
}
