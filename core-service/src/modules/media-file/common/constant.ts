export enum MediaFileKind {
    AUDIO = "audio",
    ATTACHMENT = "attachment",
    /** Tài liệu đính kèm cuộc họp, được đưa vào kho tri thức để hỏi đáp. */
    DOCUMENT = "document",
    EXPORT = "export",
}

export enum MediaFileStatus {
    UPLOADING = "uploading",
    READY = "ready",
    FAILED = "failed",
    DELETED = "deleted",
}
