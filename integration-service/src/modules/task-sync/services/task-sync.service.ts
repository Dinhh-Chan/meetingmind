import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ExternalSyncStatus } from "@module/external-task-link/common/constant";
import { ExternalTaskLinkService } from "@module/external-task-link/services/external-task-link.service";
import { IntegrationProvider } from "@module/integration/common/constant";
import { Integration } from "@module/integration/entities/integration.entity";
import {
    EventEnvelope,
    EventType,
    MEETINGMIND_EXCHANGE,
    TaskSyncCompletedPayload,
    TaskSyncRequestedPayload,
    TaskSyncResult,
} from "@module/messaging/common/constant";
import { SyncJobStatus, SyncJobType } from "@module/sync-job/common/constant";
import { SyncJob } from "@module/sync-job/entities/sync-job.entity";
import { SyncJobService } from "@module/sync-job/services/sync-job.service";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { UniqueConstraintError } from "sequelize";
import { getSecrets, TASK_SYNC_CONFIG, TaskSyncConfig } from "../common/config";
import {
    buildTelegramMessage,
    buildTrelloDescription,
    parseDeadline,
    redactSecrets,
    trelloMarker,
} from "../common/format";
import { ProviderError } from "../common/provider-error";
import { IntegrationRegistryService } from "./integration-registry.service";
import { TelegramClient } from "./telegram.client";
import { TrelloClient } from "./trello.client";

type Envelope = EventEnvelope<TaskSyncRequestedPayload>;

/**
 * Đẩy một công việc đã duyệt ra Trello (tạo thẻ) và Telegram (báo tin), rồi
 * phát `task.sync.completed` cho Core.
 *
 * Mỗi nhà cung cấp chạy độc lập: lỗi API hay cấu hình sai của bên này chỉ làm
 * bên đó `failed`. Lỗi hạ tầng (DB) thì ném ra để tin được giao lại; job nào
 * đã succeeded sẽ dùng lại kết quả, không gọi API lần nữa.
 */
@Injectable()
export class TaskSyncService {
    private readonly logger = new Logger(TaskSyncService.name);
    private readonly secrets: string[];

    constructor(
        @Inject(TASK_SYNC_CONFIG) private readonly config: TaskSyncConfig,
        private readonly registry: IntegrationRegistryService,
        private readonly syncJobService: SyncJobService,
        private readonly externalTaskLinkService: ExternalTaskLinkService,
        private readonly trello: TrelloClient,
        private readonly telegram: TelegramClient,
        private readonly amqp: AmqpConnection,
    ) {
        this.secrets = getSecrets(config);
    }

    async handle(envelope: Envelope): Promise<TaskSyncCompletedPayload> {
        const { actionItemId } = envelope.payload;
        const trello = await this.runProvider(
            IntegrationProvider.TRELLO,
            envelope,
            (integration) => this.pushTrello(envelope, integration),
        );
        // Telegram chạy sau Trello để tin nhắn kèm được link thẻ.
        const telegram = await this.runProvider(
            IntegrationProvider.TELEGRAM,
            envelope,
            (integration) => this.notifyTelegram(envelope, integration, trello),
        );
        const completed: TaskSyncCompletedPayload = {
            actionItemId,
            results: [trello, telegram],
        };
        await this.publishCompleted(envelope, completed);
        this.logger.log(
            `Đồng bộ công việc ${actionItemId}: trello=${trello.status}, telegram=${telegram.status}`,
        );
        return completed;
    }

    /** Xoá key/token khỏi chuỗi trước khi log, ghi DB hay gửi đi. */
    redact(text: string): string {
        return redactSecrets(text, this.secrets);
    }

    private async runProvider(
        provider: IntegrationProvider,
        envelope: Envelope,
        work: (integration: Integration) => Promise<TaskSyncResult>,
    ): Promise<TaskSyncResult> {
        if (!this.registry.isConfigured(provider)) {
            // Thiếu thông tin đăng nhập là chưa bật, không phải lỗi.
            return { provider, status: "skipped" };
        }
        const integration = await this.registry.get(provider);
        const job = await this.startJob(provider, envelope, integration);
        if (job.status === SyncJobStatus.SUCCEEDED) {
            this.logger.log(
                `${provider} đã đồng bộ trước đó (${job.idempotencyKey}), dùng lại kết quả`,
            );
            return job.result as TaskSyncResult;
        }

        let result: TaskSyncResult;
        try {
            result = await work(integration);
        } catch (err) {
            const error = this.redact(err?.message || String(err));
            if (!(err instanceof ProviderError)) {
                this.logger.error(`${provider} lỗi bất thường: ${error}`);
            }
            result = { provider, status: "failed", error };
        }
        await this.syncJobService.updateById(null, job._id, {
            status:
                result.status === "synced"
                    ? SyncJobStatus.SUCCEEDED
                    : SyncJobStatus.FAILED,
            result: result as unknown as Record<string, any>,
            error: result.error ?? null,
            finishedAt: new Date(),
        });
        if (result.status === "failed") {
            this.logger.warn(
                `${provider} thất bại cho công việc ${envelope.payload.actionItemId}: ${result.error}`,
            );
        }
        return result;
    }

    /**
     * Lấy hoặc tạo job theo idempotencyKey. Job đã succeeded trả về nguyên
     * trạng để người gọi dùng lại; còn lại chuyển sang running.
     */
    private async startJob(
        provider: IntegrationProvider,
        envelope: Envelope,
        integration: Integration,
    ): Promise<SyncJob> {
        const idempotencyKey = `${envelope.payload.idempotencyKey}:${provider}`;
        let job = await this.syncJobService.getOne(null, { idempotencyKey });
        if (!job) {
            try {
                return await this.syncJobService.create(null, {
                    workspaceId: envelope.workspaceId,
                    integrationId: integration._id,
                    type: SyncJobType.PUSH_TASK,
                    status: SyncJobStatus.RUNNING,
                    idempotencyKey,
                    payload: envelope.payload as unknown as Record<string, any>,
                    retryCount: 0,
                    startedAt: new Date(),
                });
            } catch (err) {
                if (!(err instanceof UniqueConstraintError)) {
                    throw err;
                }
                // Một tin khác cùng khóa vừa tạo job: coi như lần thử lại.
                job = await this.syncJobService.getOne(null, {
                    idempotencyKey,
                });
            }
        }
        if (job.status === SyncJobStatus.SUCCEEDED) {
            return job;
        }
        return this.syncJobService.updateById(null, job._id, {
            status: SyncJobStatus.RUNNING,
            retryCount: (job.retryCount ?? 0) + 1,
            startedAt: new Date(),
            finishedAt: null,
            error: null,
        });
    }

    private async pushTrello(
        envelope: Envelope,
        integration: Integration,
    ): Promise<TaskSyncResult> {
        const { payload } = envelope;
        const link = await this.externalTaskLinkService.getOne(null, {
            integrationId: integration._id,
            actionItemId: payload.actionItemId,
        });
        if (link?.syncStatus === ExternalSyncStatus.SYNCED) {
            return {
                provider: "trello",
                status: "synced",
                externalId: link.externalId,
                externalUrl: link.externalUrl,
            };
        }

        const listId = await this.trello.resolveListId();
        if (
            !this.config.trello.listId &&
            integration.config?.resolvedListId !== listId
        ) {
            await this.registry.updateConfig(IntegrationProvider.TRELLO, {
                resolvedListId: listId,
            });
        }

        // Trello không có khóa idempotency: lần trước có thể đã tạo thẻ nhưng
        // mất phản hồi, nên tra dòng đánh dấu trước khi tạo mới.
        const marker = trelloMarker(payload.actionItemId);
        let card = await this.trello.findCardByMarker(listId, marker);
        if (card) {
            this.logger.log(
                `Đã có thẻ Trello ${card.id} cho công việc ${payload.actionItemId}, không tạo lại`,
            );
        } else {
            card = await this.trello.createCard({
                listId,
                name: payload.task.title,
                desc: buildTrelloDescription(payload),
                due: parseDeadline(payload.task.deadline)?.toISOString(),
            });
        }

        const externalUrl = card.shortUrl || card.url;
        const linkData = {
            externalId: card.id,
            externalUrl,
            syncStatus: ExternalSyncStatus.SYNCED,
            lastSyncedAt: new Date(),
            lastError: null,
        };
        if (link) {
            await this.externalTaskLinkService.updateById(
                null,
                link._id,
                linkData,
            );
        } else {
            await this.externalTaskLinkService.create(null, {
                workspaceId: envelope.workspaceId,
                integrationId: integration._id,
                actionItemId: payload.actionItemId,
                provider: IntegrationProvider.TRELLO,
                ...linkData,
            });
        }
        return {
            provider: "trello",
            status: "synced",
            externalId: card.id,
            externalUrl,
        };
    }

    private async notifyTelegram(
        envelope: Envelope,
        integration: Integration,
        trello: TaskSyncResult,
    ): Promise<TaskSyncResult> {
        const chatId = await this.resolveChatId(integration);
        const text = buildTelegramMessage(
            envelope.payload,
            trello.status === "synced" ? trello.externalUrl : undefined,
        );
        const { messageId } = await this.telegram.sendMessage(chatId, text);
        return {
            provider: "telegram",
            status: "synced",
            externalId: messageId,
        };
    }

    /** TELEGRAM_CHAT_ID, không có thì chat đã dò lần trước, rồi mới dò mới. */
    private async resolveChatId(integration: Integration): Promise<string> {
        if (this.config.telegram.chatId) {
            return this.config.telegram.chatId;
        }
        if (integration.config?.chatId) {
            return String(integration.config.chatId);
        }
        const chatId = await this.telegram.discoverChatId();
        if (!chatId) {
            throw new ProviderError("Hãy nhắn một tin cho bot trước");
        }
        await this.registry.updateConfig(IntegrationProvider.TELEGRAM, {
            chatId,
            chatIdSource: "getUpdates",
        });
        this.logger.log(
            `Đã dò được chat Telegram ${chatId}, lưu lại để dùng tiếp`,
        );
        return chatId;
    }

    /**
     * Phát thẳng qua AmqpConnection sau khi đã ghi DB, chưa qua outbox: Core
     * xử lý idempotent theo actionItemId (ghi đè liên kết), nên phát lặp khi
     * tin bị giao lại là vô hại. Phát lỗi thì ném ra để tin được giao lại; lần
     * sau các job đã succeeded chỉ phát lại kết quả, không gọi API nữa.
     */
    private async publishCompleted(
        request: Envelope,
        payload: TaskSyncCompletedPayload,
    ) {
        const envelope: EventEnvelope<TaskSyncCompletedPayload> = {
            eventId: randomUUID(),
            eventType: EventType.TASK_SYNC_COMPLETED,
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            workspaceId: request.workspaceId,
            correlationId: request.correlationId,
            payload,
        };
        await this.amqp.publish(
            MEETINGMIND_EXCHANGE,
            EventType.TASK_SYNC_COMPLETED,
            envelope,
            { messageId: envelope.eventId, persistent: true },
        );
    }
}
