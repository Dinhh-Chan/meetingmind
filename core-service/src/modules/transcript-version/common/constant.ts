export enum TranscriptVersionSource {
    STT = "stt",
    MANUAL_EDIT = "manual_edit",
    RERUN = "rerun",
    /** Phụ đề nền tảng tự sinh, lấy qua extension — không qua STT. */
    LIVE_CAPTION = "live_caption",
}
