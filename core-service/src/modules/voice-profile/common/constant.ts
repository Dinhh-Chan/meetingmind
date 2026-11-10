/** Mẫu giọng mới đăng ký chờ admin nghe và xác nhận mới được dùng để nhận giọng. */
export enum VoiceProfileStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
}

/** Chất lượng mẫu do ai-service chấm: đủ giọng nói, nền yên tĩnh. */
export enum VoiceQuality {
    GOOD = "good",
    SHORT = "short",
    NOISY = "noisy",
}
