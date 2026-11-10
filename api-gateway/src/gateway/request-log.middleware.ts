import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

const SAFE_ID = /^[\w-]{8,64}$/;

/**
 * Gắn mã request (giữ mã có sẵn từ phía trước nếu hợp lệ), trả lại trong
 * X-Request-Id để dò log giữa gateway và core. Ghi IP người gọi (cũng là khoá
 * giới hạn tần suất khi chưa đăng nhập). Không ghi query string: link mời mang
 * token trong query.
 */
@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
    private readonly logger = new Logger("Gateway");

    use(req: Request, res: Response, next: NextFunction) {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
        req.headers["x-request-id"] = id;
        res.setHeader("X-Request-Id", id);
        const started = process.hrtime.bigint();
        res.on("finish", () => {
            const ms = Number(process.hrtime.bigint() - started) / 1e6;
            this.logger.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms ${req.ip} ${id}`);
        });
        next();
    }
}
