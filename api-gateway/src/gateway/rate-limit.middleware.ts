import { Inject, Injectable, NestMiddleware, OnModuleDestroy } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";
import { GATEWAY_CONFIG, GatewayConfig } from "./config";
import { reply } from "./reply";
import { isAuthLimited } from "./routes";

type Bucket = { count: number; resetAt: number };

/**
 * Giới hạn số request theo cửa sổ cố định, đếm trong bộ nhớ (một instance
 * gateway). Đăng nhập, đăng ký đếm theo IP với hạn mức thấp; còn lại đếm theo
 * người dùng khi có token (nhiều người chung IP văn phòng), không thì theo IP.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware, OnModuleDestroy {
    private readonly hits = new Map<string, Bucket>();
    private readonly sweep: NodeJS.Timeout;

    constructor(
        @Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig,
        private readonly jwt: JwtService,
    ) {
        this.sweep = setInterval(() => {
            const now = Date.now();
            for (const [key, bucket] of this.hits) if (bucket.resetAt <= now) this.hits.delete(key);
        }, config.rateLimit.windowMs);
        this.sweep.unref();
    }

    onModuleDestroy() {
        clearInterval(this.sweep);
    }

    use(req: Request, res: Response, next: NextFunction) {
        const { windowMs, max, authMax } = this.config.rateLimit;
        const auth = isAuthLimited(req.path);
        const key = auth ? `auth:${req.ip}` : `api:${this.userOf(req) ?? req.ip}`;
        const limit = auth ? authMax : max;
        const now = Date.now();
        let bucket = this.hits.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            this.hits.set(key, bucket);
        }
        bucket.count++;
        res.setHeader("RateLimit-Limit", limit);
        res.setHeader("RateLimit-Remaining", Math.max(0, limit - bucket.count));
        if (bucket.count > limit) {
            res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
            return reply(
                res,
                429,
                "error-too-many-requests",
                auth
                    ? "Thử đăng nhập quá nhiều lần, đợi một phút rồi thử lại"
                    : "Gửi quá nhiều yêu cầu, thử lại sau ít giây",
            );
        }
        next();
    }

    /** Chỉ để gom nhóm: token giả sẽ bị chặn ở bước kiểm tra token ngay sau. */
    private userOf(req: Request): string | null {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) return null;
        const payload = this.jwt.decode(header.slice(7).trim()) as { sub?: unknown } | null;
        return payload && typeof payload.sub === "string" ? `u:${payload.sub}` : null;
    }
}
