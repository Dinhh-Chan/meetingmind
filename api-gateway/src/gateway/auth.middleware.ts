import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";
import { GATEWAY_CONFIG, GatewayConfig } from "./config";
import { reply } from "./reply";
import { isInternal, isPublic } from "./routes";

/**
 * Kiểm tra access token (chữ ký, hạn) trước khi chuyển tiếp: request không có
 * token hợp lệ dừng ở đây, không tốn tài nguyên core. Quyền trên từng cuộc
 * họp, dự án vẫn do core-service quyết định.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(
        @Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig,
        private readonly jwt: JwtService,
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
        if (isInternal(req.path)) return reply(res, 404, "error-not-found", "Không tìm thấy");
        if (isPublic(req.method, req.path)) return next();
        const header = req.headers.authorization ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!token) return reply(res, 401, "error-unauthorized", "Chưa đăng nhập");
        try {
            this.jwt.verify(token, { secret: this.config.jwtSecret, algorithms: ["HS256"] });
        } catch {
            // Cùng mã 401 với core: giao diện tự làm mới phiên bằng refresh token.
            return reply(res, 401, "error-unauthorized", "Phiên đăng nhập đã hết hạn hoặc không hợp lệ");
        }
        next();
    }
}
