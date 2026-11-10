/** Cấu hình gateway đọc từ biến môi trường (docker-compose đặt sẵn). */
export interface GatewayConfig {
    port: number;
    /** core-service trong mạng Docker; mọi API nghiệp vụ hiện nằm ở đây. */
    coreUrl: string;
    /** Trùng JWT_SECRET của core-service để kiểm tra access token. */
    jwtSecret: string;
    /** Hỏi đáp tri thức chờ AI tới 60 s; tải tệp ghi âm lớn cần lâu hơn. */
    upstreamTimeoutMs: number;
    rateLimit: {
        windowMs: number;
        /** Số request mỗi người (hoặc mỗi IP khi chưa đăng nhập) trong một cửa sổ. */
        max: number;
        /** Đăng nhập, đăng ký: chặt hơn để chống dò mật khẩu. */
        authMax: number;
    };
    /** Proxy đứng trước (nginx, Next.js) được tin để lấy IP thật từ X-Forwarded-For. */
    trustProxy: string;
}

export const GATEWAY_CONFIG = Symbol("GATEWAY_CONFIG");

const num = (value: string | undefined, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
    return {
        port: num(env.SERVER_PORT, 3000),
        coreUrl: (env.CORE_SERVICE_URL ?? "http://localhost:3010").replace(/\/+$/, ""),
        jwtSecret: env.JWT_SECRET ?? "",
        upstreamTimeoutMs: num(env.GATEWAY_UPSTREAM_TIMEOUT_MS, 300_000),
        rateLimit: {
            windowMs: num(env.GATEWAY_RATE_WINDOW_MS, 60_000),
            max: num(env.GATEWAY_RATE_LIMIT, 600),
            authMax: num(env.GATEWAY_AUTH_RATE_LIMIT, 20),
        },
        trustProxy: env.GATEWAY_TRUST_PROXY ?? "loopback, linklocal, uniquelocal",
    };
}
