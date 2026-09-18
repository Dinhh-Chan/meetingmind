/**
 * Hợp đồng sự kiện — bản TypeScript của contracts/events.json.
 * Sửa ở đây thì phải sửa cả contracts/events.json và bản Python trong ai-service.
 */

export const MEETINGMIND_EXCHANGE = "meetingmind";

/** Queue của core-service: nhận kết quả AI trả về. */
export const CORE_EVENTS_QUEUE = "core.events";

/** Queue của ai-service: nhận lệnh xử lý. */
export const AI_JOBS_QUEUE = "ai.jobs";

export enum EventType {
    TRANSCRIPTION_REQUESTED = "transcription.requested",
    TRANSCRIPTION_COMPLETED = "transcription.completed",
    TRANSCRIPTION_FAILED = "transcription.failed",
    ANALYSIS_REQUESTED = "analysis.requested",
    ANALYSIS_COMPLETED = "analysis.completed",
    ANALYSIS_FAILED = "analysis.failed",
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
}

export interface TranscriptionCompletedPayload {
    jobId: string;
    meetingId: string;
    runId: string;
    model: string;
    segments: TranscriptSegmentResult[];
}

export interface AnalysisRequestedPayload {
    jobId: string;
    meetingId: string;
    transcriptVersionId: string;
    language: string;
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
