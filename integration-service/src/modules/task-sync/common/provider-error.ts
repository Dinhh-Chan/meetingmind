/**
 * Lỗi phía nhà cung cấp hoặc cấu hình sai: đánh dấu riêng nhà cung cấp đó là
 * failed, không làm hỏng cả tin nhắn.
 */
export class ProviderError extends Error {}

/** Cắt bớt phần thân lỗi trả về để log không bị tràn. */
export const shortDetail = (data: unknown, max = 200): string => {
    const text =
        typeof data === "string" ? data : JSON.stringify(data ?? "") || "";
    return text.length > max ? `${text.slice(0, max)}…` : text;
};
