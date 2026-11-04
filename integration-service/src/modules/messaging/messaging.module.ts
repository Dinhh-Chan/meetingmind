import { ProcessedMessageModule } from "@module/processed-message/processed-message.module";
import { Global, Module } from "@nestjs/common";
import { MessageDedupService } from "./services/message-dedup.service";

/**
 * Tầng nhận sự kiện: dedup để không xử lý lặp. Chưa có outbox — xem ghi chú ở
 * TaskSyncService về việc phát thẳng task.sync.completed.
 */
@Global()
@Module({
    imports: [ProcessedMessageModule],
    providers: [MessageDedupService],
    exports: [MessageDedupService],
})
export class MessagingModule {}
