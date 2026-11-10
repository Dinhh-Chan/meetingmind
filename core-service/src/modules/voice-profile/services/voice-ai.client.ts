import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lastValueFrom } from "rxjs";

export interface VoiceEmbedding {
    embedding: number[];
    seconds: number;
    model: string;
    /** good | short | noisy (ai-service cũ không trả thì trống) */
    quality?: string;
}

/** Gọi ai-service tính vân giọng từ các mẫu đọc (route nội bộ, X-Internal-Token). */
@Injectable()
export class VoiceAiClient {
    private readonly logger = new Logger(VoiceAiClient.name);

    constructor(
        private readonly http: HttpService,
        private readonly configService: ConfigService<Configuration>,
    ) {}

    /** Vân giọng của một câu ghi trực tiếp; câu quá ít giọng nói thì embedding trống. */
    async embedUtterance(audio: Buffer): Promise<{ embedding: number[] | null; seconds: number }> {
        const { serviceUrl, internalToken } = this.configService.get("ai", { infer: true });
        try {
            const res = await lastValueFrom(
                this.http.post<{ embedding: number[] | null; seconds: number }>(
                    `${serviceUrl}/internal/voice/utterance`,
                    { audio: audio.toString("base64") },
                    { headers: { "X-Internal-Token": internalToken }, timeout: 20_000, maxBodyLength: Infinity },
                ),
            );
            return res.data;
        } catch (err) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            // Đoạn âm thanh hỏng: coi như không nhận được người, giao diện giữ người nói trước.
            if (status === 422 || status === 413) return { embedding: null, seconds: 0 };
            this.logger.warn(`Tính vân giọng câu nói lỗi: ${status ? `HTTP ${status}` : ((err as Error).message ?? "không rõ")}`);
            throw ApiError.ServiceUnavailable("error-voice-unavailable");
        }
    }

    async embed(samples: Buffer[]): Promise<VoiceEmbedding> {
        const { serviceUrl, internalToken } = this.configService.get("ai", { infer: true });
        try {
            const res = await lastValueFrom(
                this.http.post<VoiceEmbedding>(
                    `${serviceUrl}/internal/voice/embedding`,
                    { samples: samples.map((s) => s.toString("base64")) },
                    { headers: { "X-Internal-Token": internalToken }, timeout: 120_000, maxBodyLength: Infinity },
                ),
            );
            return res.data;
        } catch (err) {
            const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
            // Mẫu không đạt (quá ngắn, quá nhỏ, không đọc được): báo đúng lý do cho người dùng.
            if (response?.status === 422 || response?.status === 413) {
                const detail = typeof response.data?.detail === "string" ? response.data.detail : "mẫu không hợp lệ";
                throw ApiError.BadRequest("error-voice-sample-invalid", { reason: detail });
            }
            this.logger.warn(`Tính vân giọng lỗi: ${response?.status ? `HTTP ${response.status}` : ((err as Error).message ?? "không rõ")}`);
            throw ApiError.ServiceUnavailable("error-voice-unavailable");
        }
    }
}
