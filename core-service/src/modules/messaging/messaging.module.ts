import { OutboxEventModule } from "@module/outbox-event/outbox-event.module";
import { ProcessedMessageModule } from "@module/processed-message/processed-message.module";
import { Global, Module } from "@nestjs/common";
import { MessageDedupService } from "./services/message-dedup.service";
import { OutboxPublisherService } from "./services/outbox-publisher.service";
import { OutboxService } from "./services/outbox.service";
import { RabbitTopologyService } from "./services/rabbit-topology.service";

/**
 * Tầng truyền sự kiện: outbox để không mất event, dedup để không xử lý lặp,
 * dựng sẵn queue bên nhận để event không rơi khi bên nhận chưa chạy.
 * Xem ARCHITECTURE.md mục 3.6.
 */
@Global()
@Module({
    imports: [OutboxEventModule, ProcessedMessageModule],
    providers: [
        OutboxService,
        OutboxPublisherService,
        MessageDedupService,
        RabbitTopologyService,
    ],
    exports: [OutboxService, MessageDedupService],
})
export class MessagingModule {}
