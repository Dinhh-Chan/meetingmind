import { BaseService } from "@config/service/base.service";
import { ApiError } from "@config/exception/api-error";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { MinioService } from "@module/minio/minio.service";
import { Injectable, Logger } from "@nestjs/common";
import { VoiceProfileStatus, VoiceQuality } from "../common/constant";
import { VoiceProfile } from "../entities/voice-profile.entity";
import { VoiceProfileRepository } from "../repositories/voice-profile-repository.interface";
import { VoiceAiClient } from "./voice-ai.client";

/** Số mẫu đọc khi đăng ký giọng. */
export const VOICE_MIN_SAMPLES = 2;
export const VOICE_MAX_SAMPLES = 5;

@Injectable()
export class VoiceProfileService extends BaseService<VoiceProfile, VoiceProfileRepository> {
    private readonly logger = new Logger(VoiceProfileService.name);

    constructor(
        @InjectRepository(Entity.VOICE_PROFILE)
        private readonly voiceProfileRepository: VoiceProfileRepository,
        private readonly voiceAi: VoiceAiClient,
        private readonly minioService: MinioService,
    ) {
        super(voiceProfileRepository);
    }

    /** Trạng thái đăng ký của chính mình; không trả vector ra ngoài. */
    async status(userId: string) {
        const profile = await this.voiceProfileRepository.getOne({ userId });
        if (!profile) return { enrolled: false };
        return { enrolled: true, ...VoiceProfileService.summary(profile) };
    }

    /** Thông tin hiển thị của một vân giọng (không có vector, không có object key). */
    static summary(profile: VoiceProfile) {
        return {
            userId: profile.userId,
            status: profile.status ?? VoiceProfileStatus.APPROVED,
            quality: profile.quality ?? null,
            sampleCount: profile.sampleCount,
            seconds: profile.seconds,
            consentAt: profile.consentAt,
            updatedAt: profile.updatedAt,
            hasSamples: !!profile.sampleKeys?.length,
            reviewedById: profile.reviewedById ?? null,
            reviewedAt: profile.reviewedAt ?? null,
        };
    }

    /**
     * Đăng ký (hoặc đăng ký lại) giọng từ các mẫu đọc; bắt buộc đã đồng ý.
     * Mẫu đọc được giữ lại để admin nghe; vân giọng chỉ dùng nhận giọng sau
     * khi admin xác nhận.
     */
    async enroll(userId: string, samples: { buffer: Buffer; mimetype: string }[], consent: boolean) {
        if (!consent) throw ApiError.BadRequest("error-voice-consent-required");
        if (samples.length < VOICE_MIN_SAMPLES || samples.length > VOICE_MAX_SAMPLES) {
            throw ApiError.BadRequest("error-voice-sample-count");
        }
        const { embedding, seconds, model, quality } = await this.voiceAi.embed(samples.map((s) => s.buffer));
        const stamp = Date.now();
        const sampleKeys: string[] = [];
        for (const [i, sample] of samples.entries()) {
            const key = `voice/${userId}/${stamp}-${i + 1}`;
            await this.minioService.putObject(key, sample.buffer, sample.buffer.length, sample.mimetype || "audio/webm");
            sampleKeys.push(key);
        }
        const existing = await this.voiceProfileRepository.getOne({ userId });
        const data = {
            embedding,
            seconds,
            model,
            quality: (quality as VoiceQuality) ?? undefined,
            sampleCount: samples.length,
            consentAt: new Date(),
            sampleKeys,
            sampleMimetype: samples[0]?.mimetype || "audio/webm",
            status: VoiceProfileStatus.PENDING,
            reviewedById: null,
            reviewedAt: null,
        };
        if (existing) {
            await this.voiceProfileRepository.updateById(existing._id, data);
            await this.removeSamples(existing.sampleKeys);
        } else {
            await this.voiceProfileRepository.create({ userId, ...data });
        }
        return this.status(userId);
    }

    private async removeSamples(keys?: string[] | null) {
        for (const key of keys ?? []) {
            try {
                await this.minioService.removeObject(key);
            } catch (err) {
                this.logger.warn(`Không xoá được mẫu giọng ${key}: ${err.message}`);
            }
        }
    }

    /** Xoá hẳn vân giọng và mẫu đọc (không giữ bản mềm). */
    async remove(userId: string) {
        const existing = await this.voiceProfileRepository.getOne({ userId });
        await this.voiceProfileRepository.deleteOne({ userId });
        await this.removeSamples(existing?.sampleKeys);
        return { enrolled: false };
    }

    /**
     * Vân giọng đã được xác nhận của những người trong danh sách, gửi kèm lệnh
     * phiên âm. Bản chờ xác nhận hoặc bị từ chối không dùng để gợi ý tên.
     */
    async profilesFor(userIds: string[]) {
        if (!userIds.length) return [];
        const profiles = await this.voiceProfileRepository.getMany({ userId: { $in: userIds } });
        return profiles
            .filter((p) => !p.status || p.status === VoiceProfileStatus.APPROVED)
            .map((p) => ({ userId: p.userId, embedding: p.embedding }));
    }

    /**
     * Người (trong danh sách) có vân giọng đã xác nhận giống câu nói nhất, nếu
     * đủ giống. Cùng ngưỡng với ghép giọng sau cuộc họp (AI_VOICE_MATCH_THRESHOLD).
     */
    async identify(embedding: number[], userIds: string[]) {
        const profiles = await this.profilesFor(userIds);
        const threshold = Number(process.env.AI_VOICE_MATCH_THRESHOLD ?? 0.5);
        const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
        const a = norm(embedding);
        let best: { userId: string; score: number } | null = null;
        for (const p of profiles) {
            if (!p.embedding || p.embedding.length !== embedding.length) continue;
            const dot = p.embedding.reduce((s, x, i) => s + x * embedding[i], 0);
            const score = dot / (a * norm(p.embedding));
            if (score >= threshold && (!best || score > best.score)) {
                best = { userId: p.userId, score: Math.round(score * 1000) / 1000 };
            }
        }
        return best;
    }

    /** Vân giọng của các thành viên (màn admin), không kèm vector. */
    async listFor(userIds: string[]) {
        if (!userIds.length) return [];
        const profiles = await this.voiceProfileRepository.getMany({ userId: { $in: userIds } });
        return profiles.map((p) => VoiceProfileService.summary(p));
    }

    /** Admin xác nhận hoặc từ chối mẫu giọng. */
    async review(userId: string, approve: boolean, reviewerId: string) {
        const profile = await this.voiceProfileRepository.getOne({ userId });
        if (!profile) throw ApiError.NotFound("error-voice-not-found");
        const updated = await this.voiceProfileRepository.updateById(profile._id, {
            status: approve ? VoiceProfileStatus.APPROVED : VoiceProfileStatus.REJECTED,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
        });
        return VoiceProfileService.summary(updated);
    }

    /** Một mẫu đọc (đánh số từ 0) để nghe lại. */
    async sample(userId: string, index: number) {
        const profile = await this.voiceProfileRepository.getOne({ userId });
        const key = profile?.sampleKeys?.[index];
        if (!key) throw ApiError.NotFound("error-voice-not-found");
        return { stream: await this.minioService.getObject(key), mimetype: profile.sampleMimetype || "audio/webm" };
    }
}
