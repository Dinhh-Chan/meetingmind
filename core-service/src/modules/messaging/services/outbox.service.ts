import { OutboxStatus } from "@module/outbox-event/common/constant";
import { OutboxEventService } from "@module/outbox-event/services/outbox-event.service";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { EventEnvelope, EventType } from "../common/constant";

export interface EmitOptions {
    aggregateType: string;
    aggregateId: string;
    eventType: EventType;
    workspaceId: string;
    correlationId?: string;
    payload: Record<string, any>;
    /** Truyền transaction của lệnh ghi nghiệp vụ để event nằm cùng một transaction. */
    transaction?: unknown;
}

/**
 * Ghi sự kiện vào `outbox_events`.
 *
 * Phải gọi trong **cùng transaction** với thay đổi nghiệp vụ sinh ra nó. Nếu
 * transaction rollback thì event cũng biến mất — không có chuyện dữ liệu chưa
 * ghi mà event đã bay ra ngoài, hoặc ngược lại.
 */
@Injectable()
export class OutboxService {
    constructor(private readonly outboxEventService: OutboxEventService) {}

    async emit(options: EmitOptions) {
        const eventId = randomUUID();
        const envelope: EventEnvelope = {
            eventId,
            eventType: options.eventType,
            eventVersion: 1,
            occurredAt: new Date().toISOString(),
            workspaceId: options.workspaceId,
            correlationId: options.correlationId || options.aggregateId,
            payload: options.payload,
        };

        return this.outboxEventService.create(
            null,
            {
                aggregateType: options.aggregateType,
                aggregateId: options.aggregateId,
                eventType: options.eventType,
                eventVersion: 1,
                payload: envelope as unknown as Record<string, any>,
                status: OutboxStatus.PENDING,
                retryCount: 0,
            },
            options.transaction ? { transaction: options.transaction } : {},
        );
    }
}
