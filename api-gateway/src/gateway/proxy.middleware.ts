import { Inject, Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { Request, Response } from "express";
import { request as httpRequest, type OutgoingHttpHeaders } from "http";
import { request as httpsRequest } from "https";
import { GATEWAY_CONFIG, GatewayConfig } from "./config";
import { reply } from "./reply";

/** Header chỉ có nghĩa trên từng chặng kết nối, không chuyển tiếp. */
const HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
]);

class UpstreamTimeout extends Error {}

const forwardable = (headers: Record<string, string | string[] | undefined>) => {
    const out: OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined && !HOP_BY_HOP.has(key)) out[key] = value;
    }
    return out;
};

/**
 * Chuyển tiếp nguyên luồng request (kể cả tệp ghi âm lớn, không đọc hết vào
 * bộ nhớ) tới core-service và trả nguyên phản hồi về. Hiện mọi API nghiệp vụ
 * nằm ở core; dịch vụ khác chỉ được gọi trong mạng nội bộ.
 */
@Injectable()
export class ProxyMiddleware implements NestMiddleware {
    private readonly logger = new Logger("Proxy");

    constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

    use(req: Request, res: Response) {
        const url = new URL(`${this.config.coreUrl}${req.originalUrl}`);
        const headers = forwardable(req.headers);
        const peer = req.socket.remoteAddress ?? "";
        const forwardedFor = req.headers["x-forwarded-for"];
        headers["x-forwarded-for"] = forwardedFor ? `${forwardedFor}, ${peer}` : peer;
        headers["x-forwarded-proto"] ??= req.protocol;
        headers["x-forwarded-host"] ??= req.headers.host ?? "";

        const send = url.protocol === "https:" ? httpsRequest : httpRequest;
        const upstream = send(
            url,
            { method: req.method, headers, timeout: this.config.upstreamTimeoutMs },
            (answer) => {
                res.writeHead(answer.statusCode ?? 502, forwardable(answer.headers));
                answer.pipe(res);
            },
        );
        upstream.on("timeout", () => upstream.destroy(new UpstreamTimeout("timeout")));
        upstream.on("error", (err) => {
            const timeout = err instanceof UpstreamTimeout;
            this.logger.warn(`${req.method} ${req.path} → core: ${err.message}`);
            reply(
                res,
                timeout ? 504 : 502,
                timeout ? "error-gateway-timeout" : "error-bad-gateway",
                timeout ? "Dịch vụ phản hồi quá lâu, thử lại sau" : "Dịch vụ tạm thời không phản hồi, thử lại sau",
            );
        });
        // Người dùng huỷ giữa chừng (đóng tab khi đang tải lên): dừng luôn request phía sau.
        res.on("close", () => {
            if (!res.writableFinished) upstream.destroy();
        });
        req.pipe(upstream);
    }
}
