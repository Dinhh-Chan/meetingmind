import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { ErrorCode } from "@config/exception/error-code";
import { KnowledgeSourceType } from "@module/messaging/common/constant";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lastValueFrom } from "rxjs";

/** Mô hình trả lời có thể mất vài chục giây với câu hỏi dài. */
export const KNOWLEDGE_AI_TIMEOUT_MS = 60_000;

export interface KnowledgeAskRequest {
    workspaceId: string;
    /** Người hỏi, Core lấy từ token: AI dùng để gắn hội thoại đúng chủ. */
    userId: string;
    /** Thiếu thì AI tạo hội thoại mới; ngữ cảnh lượt trước AI tự đọc từ DB. */
    threadId?: string;
    question: string;
    /** Core đã lọc theo quyền người hỏi; AI chỉ tìm trong các cuộc họp này. */
    meetingIds: string[];
}

export interface KnowledgeCitation {
    n: number;
    meetingId: string;
    meetingTitle: string;
    sourceType: KnowledgeSourceType;
    sourceId: string;
    startMs?: number;
    speaker?: string;
    quote: string;
}

export interface KnowledgeAskResponse {
    /** Rỗng khi ai-service bản cũ chưa lưu hội thoại. */
    threadId?: string;
    messageId?: string;
    /** Có dấu [n] trỏ tới citations. */
    answer: string;
    list?: string[];
    insufficient: boolean;
    model: string;
    citations: KnowledgeCitation[];
}

export interface KnowledgeSource {
    meetingId: string;
    meetingTitle: string;
    sourceType: KnowledgeSourceType;
    sourceId: string;
    title: string;
    chunks: number;
    indexedAt: string;
}

export interface KnowledgeThreadSummary {
    threadId: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface KnowledgeThreadMessage {
    messageId: string;
    role: "user" | "assistant";
    content: string;
    list?: string[];
    citations: KnowledgeCitation[];
    insufficient: boolean;
    model?: string;
    createdAt: string;
}

export interface KnowledgeThread {
    threadId: string;
    title: string;
    messages: KnowledgeThreadMessage[];
}

/** Hội thoại luôn thuộc đúng một người trong một workspace. */
export interface KnowledgeThreadKey {
    workspaceId: string;
    userId: string;
    threadId: string;
}

/**
 * Gọi route nội bộ của ai-service (contracts/events.json mục `http`).
 *
 * Mọi lỗi — chưa chạy, quá giờ, sai khoá — đều thành 503 "chưa sẵn sàng":
 * người dùng không làm gì khác được, còn chi tiết nằm ở log. Riêng 404 của các
 * route có threadId là "hội thoại không phải của bạn/đã xoá", người dùng cần
 * biết để mở hội thoại khác. Lỗi axios mang cả header của request nên không
 * được ném tiếp hay ghi nguyên văn (lộ khoá).
 */
@Injectable()
export class KnowledgeAiClient {
    private readonly logger = new Logger(KnowledgeAiClient.name);

    constructor(
        private readonly http: HttpService,
        private readonly configService: ConfigService<Configuration>,
    ) {}

    async ask(body: KnowledgeAskRequest): Promise<KnowledgeAskResponse> {
        const data = await this.post<Partial<KnowledgeAskResponse>>(
            "/internal/knowledge/ask",
            body,
            body.threadId ? "error-thread-not-found" : undefined,
        );
        return {
            threadId: text(data?.threadId) || undefined,
            messageId: text(data?.messageId) || undefined,
            answer: typeof data?.answer === "string" ? data.answer : "",
            list: Array.isArray(data?.list) ? data.list.map(String) : undefined,
            insufficient: Boolean(data?.insufficient),
            model: typeof data?.model === "string" ? data.model : "",
            citations: Array.isArray(data?.citations) ? data.citations : [],
        };
    }

    async sources(body: {
        workspaceId: string;
        meetingIds: string[];
    }): Promise<KnowledgeSource[]> {
        const data = await this.post<KnowledgeSource[]>(
            "/internal/knowledge/sources",
            body,
        );
        return Array.isArray(data) ? data : [];
    }

    async listThreads(body: {
        workspaceId: string;
        userId: string;
    }): Promise<KnowledgeThreadSummary[]> {
        const data = await this.post<KnowledgeThreadSummary[]>(
            "/internal/knowledge/threads/list",
            body,
        );
        return Array.isArray(data) ? data.filter((t) => text(t?.threadId)) : [];
    }

    async getThread(body: KnowledgeThreadKey): Promise<KnowledgeThread> {
        const data = await this.post<Partial<KnowledgeThread>>(
            "/internal/knowledge/threads/get",
            body,
            "error-thread-not-found",
        );
        return {
            threadId: text(data?.threadId) || body.threadId,
            title: text(data?.title),
            messages: Array.isArray(data?.messages) ? data.messages : [],
        };
    }

    async renameThread(
        body: KnowledgeThreadKey & { title: string },
    ): Promise<{ threadId: string; title: string }> {
        const data = await this.post<{ threadId?: string; title?: string }>(
            "/internal/knowledge/threads/rename",
            body,
            "error-thread-not-found",
        );
        return {
            threadId: text(data?.threadId) || body.threadId,
            title: text(data?.title) || body.title,
        };
    }

    async deleteThread(body: KnowledgeThreadKey) {
        await this.post(
            "/internal/knowledge/threads/delete",
            body,
            "error-thread-not-found",
        );
        return { deleted: true, threadId: body.threadId };
    }

    /** `notFound`: mã lỗi trả cho người dùng khi AI báo 404 (hội thoại không thuộc họ). */
    private async post<T>(
        path: string,
        body: unknown,
        notFound?: ErrorCode,
    ): Promise<T> {
        const { serviceUrl, internalToken } = this.configService.get("ai", {
            infer: true,
        });
        try {
            const res = await lastValueFrom(
                this.http.post<T>(`${serviceUrl}${path}`, body, {
                    headers: { "X-Internal-Token": internalToken },
                    timeout: KNOWLEDGE_AI_TIMEOUT_MS,
                }),
            );
            return res.data;
        } catch (err) {
            const status = (err as { response?: { status?: number } })?.response
                ?.status;
            const code = (err as { code?: string })?.code;
            if (status === 404 && notFound) throw ApiError.NotFound(notFound);
            this.logger.warn(
                `Gọi ai-service ${path} lỗi: ${status ? `HTTP ${status}` : (code ?? "không rõ")}`,
            );
            throw ApiError.ServiceUnavailable("error-knowledge-unavailable");
        }
    }
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
