import type { Response } from "express";

/** Lỗi do gateway trả, cùng dạng JSON với core-service để giao diện xử lý như nhau. */
export function reply(res: Response, status: number, code: string, message: string) {
    if (res.headersSent) return res.destroy();
    res.status(status).json({ success: false, status, code, message });
}
