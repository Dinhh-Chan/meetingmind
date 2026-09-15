export enum ProcessingJobType {
    TRANSCRIBE = "transcribe",
    SUMMARIZE = "summarize",
    EXTRACT_ACTIONS = "extract_actions",
    DETECT_RISKS = "detect_risks",
    INDEX_RAG = "index_rag",
}

export enum ProcessingJobStatus {
    QUEUED = "queued",
    RUNNING = "running",
    SUCCEEDED = "succeeded",
    FAILED = "failed",
    CANCELLED = "cancelled",
}
