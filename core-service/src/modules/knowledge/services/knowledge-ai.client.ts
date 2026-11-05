import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { KnowledgeSourceType } from "@module/messaging/common/constant";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lastValueFrom } from "rxjs";

/** Mô hình trả lời có thể mất vài chục giây với câu hỏi dài. */
export const KNOWLEDGE_AI_TIMEOUT_MS = 60_000;

export interface KnowledgeHistoryTurn {
    role: "user" | "assistant";
    content: string;
}

export interface KnowledgeAskRequest {
    workspaceId: string;
    question: string;
    /** Core đã lọc theo quyền người hỏi; AI chỉ tìm trong các cuộc họp này. */
    meetingIds: string[];
    history?: KnowledgeHistoryTurn[];
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

/**
 * Gọi route nội bộ của ai-service (contracts/events.json mục `http`).
 *
 * Mọi lỗi — chưa chạy, quá giờ, sai khoá — đều thành 503 "chưa sẵn sàng":
 * người dùng không làm gì khác được, còn chi tiết nằm ở log. Lỗi axios mang cả
 * header của request nên không được ném tiếp hay ghi nguyên văn (lộ khoá).
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
        );
        return {
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

    private async post<T>(path: string, body: unknown): Promise<T> {
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
            this.logger.warn(
                `Gọi ai-service ${path} lỗi: ${status ? `HTTP ${status}` : (code ?? "không rõ")}`,
            );
            throw ApiError.ServiceUnavailable("error-knowledge-unavailable");
        }
    }
}
