import { ProcessedMessageService } from "@module/processed-message/services/processed-message.service";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Chống xử lý lặp: RabbitMQ đảm bảo at-least-once, nên cùng một message có thể
 * được giao nhiều lần. Ghi `(messageId, consumer)` vào `processed_messages`
 * trước khi xử lý; trùng thì bỏ qua.
 */
@Injectable()
export class MessageDedupService {
    private readonly logger = new Logger(MessageDedupService.name);

    constructor(
        private readonly processedMessageService: ProcessedMessageService,
    ) {}

    /**
     * Trả về true nếu đây là lần đầu thấy message này.
     * False nghĩa là đã xử lý rồi, người gọi nên bỏ qua.
     */
    async claim(messageId: string, consumer: string): Promise<boolean> {
        try {
            await this.processedMessageService.create(null, {
                messageId,
                consumer,
                processedAt: new Date(),
            });
            return true;
        } catch (err) {
            // Unique (messageId, consumer) chặn — đã xử lý rồi.
            this.logger.debug(
                `Bỏ qua message đã xử lý ${messageId} / ${consumer}`,
            );
            return false;
        }
    }
}
