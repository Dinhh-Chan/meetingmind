export enum SyncJobType {
    PUSH_TASK = "push_task",
    PULL_STATUS = "pull_status",
    EXPORT_MINUTES = "export_minutes",
}

export enum SyncJobStatus {
    QUEUED = "queued",
    RUNNING = "running",
    SUCCEEDED = "succeeded",
    FAILED = "failed",
    CANCELLED = "cancelled",
}
