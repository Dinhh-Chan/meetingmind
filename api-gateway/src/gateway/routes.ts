/**
 * Luật định tuyến của gateway. Gateway không chứa phân quyền nghiệp vụ (việc
 * của core-service): chỉ biết route nào được gọi khi chưa đăng nhập, route nào
 * không được gọi từ ngoài, và chuyển tiếp tới dịch vụ nào.
 */

type Rule = { method: string; path: RegExp };

/** Gọi được khi chưa đăng nhập. */
const PUBLIC_ROUTES: Rule[] = [
    { method: "POST", path: /^\/auth\/(login|register|refresh|logout|google)\/?$/ },
    { method: "GET", path: /^\/auth\/(providers|invite)\/?$/ },
    { method: "GET", path: /^\/app\/timestamp\/?$/ },
];

/** Kênh nội bộ giữa các service: chỉ gọi trong mạng Docker, không qua gateway. */
const INTERNAL_PREFIXES = [/^\/microservice(\/|$)/, /^\/internal(\/|$)/];

/** Đăng nhập, đăng ký: giới hạn chặt hơn theo IP. */
const AUTH_LIMITED = /^\/auth\/(login|register|google)\/?$/;

export const isPublic = (method: string, path: string) =>
    method === "OPTIONS" || PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));

export const isInternal = (path: string) => INTERNAL_PREFIXES.some((p) => p.test(path));

export const isAuthLimited = (path: string) => AUTH_LIMITED.test(path);
