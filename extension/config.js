/** Đổi khi chạy thật; mặc định trỏ vào core-service local. */
export const DEFAULT_API = "http://localhost:3010";

/** Gom phụ đề rồi gửi theo lô, tránh mỗi câu một request. */
export const FLUSH_INTERVAL_MS = 5000;

/** Một lượt nói coi là kết thúc khi text ngừng đổi trong ngần này. */
export const SETTLE_MS = 1500;
