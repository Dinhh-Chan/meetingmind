/**
 * Hợp đồng sự kiện — bản TypeScript của contracts/events.json.
 * Sửa ở đây thì phải sửa cả contracts/events.json và bản Python trong ai-service.
 */

export const MEETINGMIND_EXCHANGE = "meetingmind";

/** Queue của core-service: nhận kết quả AI trả về. */
export const CORE_EVENTS_QUEUE = "core.events";

/** Queue của ai-service: nhận lệnh xử lý. */
export const AI_JOBS_QUEUE = "ai.jobs";

/**
 * Queue của bot-worker. Lệnh vào phòng chạy hàng giờ nên lệnh dừng đi queue
 * riêng — chung một queue thì lệnh dừng phải chờ phiên ghi âm xong mới tới lượt.
 */
export const BOT_JOBS_QUEUE = "bot.jobs";
export const BOT_CONTROL_QUEUE = "bot.control";

/** Queue của integration-service: đẩy công việc đã duyệt ra công cụ ngoài. */
export const INTEGRATION_JOBS_QUEUE = "integration.jobs";

export enum EventType {
    TRANSCRIPTION_REQUESTED = "transcription.requested",
    TRANSCRIPTION_COMPLETED = "transcription.completed",
    TRANSCRIPTION_FAILED = "transcription.failed",
    ANALYSIS_REQUESTED = "analysis.requested",
    ANALYSIS_COMPLETED = "analysis.completed",
    ANALYSIS_FAILED = "analysis.failed",
    BOT_JOIN_REQUESTED = "bot.join.requested",
    BOT_STOP_REQUESTED = "bot.stop.requested",
    BOT_STATUS_CHANGED = "bot.status.changed",
    RECORDING_COMPLETED = "recording.completed",
    TASK_SYNC_REQUESTED = "task.sync.requested",
    TASK_SYNC_COMPLETED = "task.sync.completed",
    KNOWLEDGE_INDEX_REQUESTED = "knowledge.index.requested",
    KNOWLEDGE_DELETE_REQUESTED = "knowledge.delete.requested",
}

/**
 * Queue của các bên nhận lệnh từ Core, Core tự dựng sẵn lúc khởi động. RabbitMQ
 * bỏ tin phát vào routing key chưa có queue nào bind, nên nếu bên nhận chưa
 * chạy lần nào thì lệnh mất (lần reindex đầu từng mất như vậy). Tham số phải
 * trùng hệt chỗ bên nhận tự khai — lệch là PRECONDITION_FAILED:
 * ai-service/app/worker/main.py, bot-worker/app/main.py (durable=True),
 * integration-service task-sync.consumer.ts (`queueOptions: { durable: true }`).
 */
export const DOWNSTREAM_QUEUES: { queue: string; routingKeys: EventType[] }[] =
    [
        {
            queue: AI_JOBS_QUEUE,
            routingKeys: [
                EventType.TRANSCRIPTION_REQUESTED,
                EventType.ANALYSIS_REQUESTED,
                EventType.KNOWLEDGE_INDEX_REQUESTED,
                EventType.KNOWLEDGE_DELETE_REQUESTED,
            ],
        },
        { queue: BOT_JOBS_QUEUE, routingKeys: [EventType.BOT_JOIN_REQUESTED] },
        {
            queue: BOT_CONTROL_QUEUE,
            routingKeys: [EventType.BOT_STOP_REQUESTED],
        },
        {
            queue: `${INTEGRATION_JOBS_QUEUE}.task-sync`,
            routingKeys: [EventType.TASK_SYNC_REQUESTED],
        },
    ];

export interface EventEnvelope<T = Record<string, any>> {
    eventId: string;
    eventType: EventType;
    eventVersion: number;
    occurredAt: string;
    workspaceId: string;
    correlationId: string;
    payload: T;
}

export interface TranscriptionRequestedPayload {
    jobId: string;
    meetingId: string;
    fileId: string;
    bucket: string;
    objectKey: string;
    language: string;
}

export interface TranscriptSegmentResult {
    speakerLabel: string;
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
    /** Ngôn ngữ STT nhận diện cho riêng đoạn này (ISO 639-1). */
    language?: string;
    /** Có dấu hiệu hai người nói chồng: lời người kia có thể bị thiếu. */
    isOverlapping?: boolean;
}

export interface TranscriptionCompletedPayload {
    jobId: string;
    meetingId: string;
    runId: string;
    model: string;
    segments: TranscriptSegmentResult[];
    /** Ngôn ngữ nói nhiều nhất trong bản ghi. */
    language?: string;
    /** Tỷ lệ thời lượng theo ngôn ngữ, ví dụ { vi: 0.8, en: 0.2 }. */
    languages?: Record<string, number>;
}

/** Một đoạn transcript gửi cho AI phân tích. */
export interface AnalysisSegment {
    /** Số thứ tự trong phiên bản: AI trả lại ở transcriptSequence làm bằng chứng. */
    sequence: number;
    /** Tên đã gán cho nhãn người nói nếu có, không thì chính nhãn. */
    speaker: string;
    text: string;
    startMs: number;
    endMs: number;
    language?: string;
}

export interface AnalysisRequestedPayload {
    jobId: string;
    meetingId: string;
    transcriptVersionId: string;
    language: string;
    /** AI không đọc DB của Core, nên transcript đi kèm lệnh. */
    segments: AnalysisSegment[];
}

export interface ProposedDecision {
    title: string;
    description?: string;
    quote?: string;
    transcriptSequence?: number;
}

export interface ProposedActionItem {
    title: string;
    description?: string;
    /** Tên người nói trong transcript, KHÔNG phải userId. Core không tự map. */
    assigneeHint?: string;
    /** Giữ nguyên câu gốc, ví dụ "thứ Sáu". Core chuẩn hóa sau. */
    deadlineRawText?: string;
    priority?: string;
    confidence?: number;
    quote?: string;
    transcriptSequence?: number;
}

export interface AnalysisCompletedPayload {
    jobId: string;
    meetingId: string;
    transcriptVersionId: string;
    runId: string;
    model: string;
    summary: string;
    openIssues: string[];
    decisions: ProposedDecision[];
    actionItems: ProposedActionItem[];
}

export interface JobFailedPayload {
    jobId: string;
    meetingId: string;
    error: string;
}

/* ------------------------------------------------------------------ bot */

export interface BotJoinRequestedPayload {
    botSessionId: string;
    meetingId: string;
    joinUrl: string;
}

export interface BotStopRequestedPayload {
    botSessionId: string;
}

export interface BotStatusChangedPayload {
    botSessionId: string;
    meetingId: string;
    /** Trùng BotSessionStatus: joining, waiting_admission, recording, left, failed. */
    status: string;
    /** Lý do rời phòng hoặc lỗi, để hiện cho người dùng. */
    detail?: string;
    error?: string;
}

export interface RecordingCompletedPayload {
    botSessionId: string;
    meetingId: string;
    bucket: string;
    objectKey: string;
    durationMs: number;
    sizeBytes: number;
    endReason: string;
}

/**
 * Công việc vừa được duyệt, gửi sang integration-service để tạo thẻ Trello và
 * báo Telegram. Integration không đọc DB của Core nên ảnh chụp công việc đi kèm.
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

/* ------------------------------------------------------------- tri thức */

export type KnowledgeSourceType =
    | "transcript"
    | "minutes"
    | "decision"
    | "action_item"
    | "document";

/** Một đoạn nội dung có sẵn để ai-worker cắt và nhúng vector. */
export interface KnowledgeItem {
    text: string;
    /** Transcript: tên đã gán cho nhãn người nói, không thì chính nhãn. */
    speaker?: string;
    startMs?: number;
    endMs?: number;
    /** Tiêu đề mục, ví dụ "Tóm tắt", tên quyết định. */
    title?: string;
}

/**
 * Xin ai-worker (lập) chỉ mục một nguồn. AI không đọc DB của Core nên nội dung
 * đi kèm; riêng tài liệu tải lên thì gửi object key để worker tự tải và tách chữ.
 */
export interface KnowledgeIndexRequestedPayload {
    meetingId: string;
    projectId?: string;
    meetingTitle: string;
    /** ISO 8601. */
    meetingDate?: string;
    sourceType: KnowledgeSourceType;
    /** transcriptVersionId / minutesVersionId / decisionId / actionItemId / fileId. */
    sourceId: string;
    sourceVersion?: string;
    items?: KnowledgeItem[];
    document?: {
        bucket: string;
        objectKey: string;
        fileName: string;
        mimetype: string;
    };
}

/** Xoá các đoạn khớp mọi trường được gửi (ít nhất một trường). */
export interface KnowledgeDeleteRequestedPayload {
    meetingId?: string;
    sourceType?: KnowledgeSourceType;
    sourceId?: string;
}
