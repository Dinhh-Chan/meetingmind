/** Loại thay đổi ghi vào nhật ký hoạt động (Cài đặt › Nhật ký hoạt động). */
export enum ActivityType {
    PERMISSION_GRANTED = "permission_granted",
    SPEAKER_ASSIGNED = "speaker_assigned",
    MINUTES_EDITED = "minutes_edited",
    MINUTES_APPROVED = "minutes_approved",
    TASK_APPROVED = "task_approved",
    ASSIGNEE_CHANGED = "assignee_changed",
    INTEGRATION_CONNECTED = "integration_connected",
    SYNC_FAILED = "sync_failed",
    RETENTION_CHANGED = "retention_changed",
    VOICE_REVIEWED = "voice_reviewed",
    TEMPLATE_CHANGED = "template_changed",
}
