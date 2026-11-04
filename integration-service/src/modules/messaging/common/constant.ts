/**
 * Hợp đồng sự kiện — phần integration-service dùng, chép từ
 * core-service/src/modules/messaging/common/constant.ts và contracts/events.json.
 * Sửa hợp đồng thì sửa cả ba chỗ.
 */

export const MEETINGMIND_EXCHANGE = "meetingmind";

/** Queue của integration-service: đẩy công việc đã duyệt ra công cụ ngoài. */
export const INTEGRATION_JOBS_QUEUE = "integration.jobs";

export enum EventType {
    TASK_SYNC_REQUESTED = "task.sync.requested",
    TASK_SYNC_COMPLETED = "task.sync.completed",
}

export interface EventEnvelope<T = Record<string, any>> {
    eventId: string;
    eventType: EventType;
    eventVersion: number;
    occurredAt: string;
    workspaceId: string;
    correlationId: string;
    payload: T;
}

/**
 * Công việc vừa được duyệt. Integration không đọc DB của Core nên ảnh chụp
 * công việc đi kèm.
 */
export interface TaskSyncRequestedPayload {
    actionItemId: string;
    meetingId: string;
    /** Một công việc chỉ được đẩy ra ngoài một lần, kể cả khi tin bị giao lặp. */
    idempotencyKey: string;
    task: {
        title: string;
        description?: string;
        /** Tên người thực hiện đã chốt khi duyệt (không phải userId). */
        assigneeName?: string;
        /** Hạn đã chuẩn hoá, ISO 8601. */
        deadline?: string;
        /** Câu gốc khi chưa chốt ngày, ví dụ "thứ Sáu". */
        deadlineRawText?: string;
        priority: string;
        meetingTitle: string;
        sourceQuote?: string;
    };
}

export type ExternalProvider = "trello" | "telegram";

export interface TaskSyncResult {
    provider: ExternalProvider;
    /** skipped: chưa cấu hình nhà cung cấp này. */
    status: "synced" | "failed" | "skipped";
    externalId?: string;
    externalUrl?: string;
    error?: string;
}

export interface TaskSyncCompletedPayload {
    actionItemId: string;
    results: TaskSyncResult[];
}
