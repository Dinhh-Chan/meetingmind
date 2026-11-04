import { Injectable } from "@nestjs/common";
import { ProviderError } from "../common/provider-error";

export const DEFAULT_HTTP_TIMEOUT_MS = 10_000;

export interface HttpRequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string | number | boolean | undefined>;
    /** Gửi dạng JSON. */
    body?: unknown;
    timeoutMs?: number;
}

export interface HttpResponse<T = any> {
    status: number;
    ok: boolean;
    /** JSON nếu đọc được, không thì chuỗi thô (Trello trả lỗi dạng text). */
    data: T;
}

/**
 * Bọc `fetch` có sẵn của Node, thêm timeout. Tách thành injectable để test
 * thay được, không gọi mạng thật.
 */
@Injectable()
export class HttpClient {
    async request<T = any>(
        url: string,
        options: HttpRequestOptions = {},
    ): Promise<HttpResponse<T>> {
        const target = new URL(url);
        for (const [key, value] of Object.entries(options.query ?? {})) {
            if (value !== undefined) {
                target.searchParams.set(key, String(value));
            }
        }
        const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
        const hasBody = options.body !== undefined;
        try {
            const res = await fetch(target, {
                method: options.method ?? "GET",
                headers: hasBody
                    ? { "Content-Type": "application/json" }
                    : undefined,
                body: hasBody ? JSON.stringify(options.body) : undefined,
                signal: AbortSignal.timeout(timeoutMs),
            });
            const text = await res.text();
            let data: any = text;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                // Không phải JSON: giữ nguyên chuỗi.
            }
            return { status: res.status, ok: res.ok, data };
        } catch (err) {
            // Lỗi mạng/timeout là lỗi phía nhà cung cấp. Chỉ nêu host: đường
            // dẫn (Telegram) và query (Trello) chứa token.
            const reason =
                err?.name === "TimeoutError"
                    ? `quá ${timeoutMs}ms không phản hồi`
                    : err?.cause?.code || err?.name || "lỗi mạng";
            throw new ProviderError(`Không gọi được ${target.host}: ${reason}`);
        }
    }
}
