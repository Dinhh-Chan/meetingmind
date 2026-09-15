export enum MeetingSourceType {
    MEETING_LINK = "meeting_link",
    IN_PERSON = "in_person",
    UPLOAD = "upload",
}

export enum MeetingPlatform {
    GOOGLE_MEET = "google_meet",
    TEAMS = "teams",
    ZOOM = "zoom",
    OTHER = "other",
}

export enum MeetingAccessScope {
    PROJECT = "project",
    RESTRICTED = "restricted",
}

export enum MeetingStatus {
    SCHEDULED = "scheduled",
    IN_PROGRESS = "in_progress",
    ENDED = "ended",
    CANCELLED = "cancelled",
}

export enum ProcessingStatus {
    PENDING = "pending",
    TRANSCRIBING = "transcribing",
    SUMMARIZING = "summarizing",
    INDEXING = "indexing",
    DONE = "done",
    FAILED = "failed",
}
