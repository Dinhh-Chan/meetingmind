import { ExternalTaskLinkModule } from "@module/external-task-link/external-task-link.module";
import { IntegrationModule } from "@module/integration/integration.module";
import { MessagingModule } from "@module/messaging/messaging.module";
import { SyncJobModule } from "@module/sync-job/sync-job.module";
import { Module } from "@nestjs/common";
import { TaskSyncConfigProvider } from "./common/config";
import { TaskSyncConsumer } from "./consumers/task-sync.consumer";
import { HttpClient } from "./services/http-client.service";
import { IntegrationRegistryService } from "./services/integration-registry.service";
import { TaskSyncService } from "./services/task-sync.service";
import { TelegramClient } from "./services/telegram.client";
import { TrelloClient } from "./services/trello.client";

/**
 * Đồng bộ một chiều công việc đã duyệt: tạo thẻ Trello, báo tin Telegram.
 * Nhận `task.sync.requested`, trả `task.sync.completed`.
 */
@Module({
    imports: [
        IntegrationModule,
        ExternalTaskLinkModule,
        SyncJobModule,
        MessagingModule,
    ],
    providers: [
        TaskSyncConfigProvider,
        HttpClient,
        TrelloClient,
        TelegramClient,
        IntegrationRegistryService,
        TaskSyncService,
        TaskSyncConsumer,
    ],
})
export class TaskSyncModule {}
