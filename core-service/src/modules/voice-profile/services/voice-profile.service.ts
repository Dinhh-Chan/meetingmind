import { BaseService } from "@config/service/base.service";
import { ApiError } from "@config/exception/api-error";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { VoiceProfile } from "../entities/voice-profile.entity";
import { VoiceProfileRepository } from "../repositories/voice-profile-repository.interface";
import { VoiceAiClient } from "./voice-ai.client";

/** Số mẫu đọc khi đăng ký giọng. */
export const VOICE_MIN_SAMPLES = 2;
export const VOICE_MAX_SAMPLES = 5;

@Injectable()
export class VoiceProfileService extends BaseService<VoiceProfile, VoiceProfileRepository> {
    constructor(
        @InjectRepository(Entity.VOICE_PROFILE)
        private readonly voiceProfileRepository: VoiceProfileRepository,
        private readonly voiceAi: VoiceAiClient,
    ) {
        super(voiceProfileRepository);
    }

    /** Trạng thái đăng ký của chính mình; không trả vector ra ngoài. */
    async status(userId: string) {
        const profile = await this.voiceProfileRepository.getOne({ userId });
        if (!profile) return { enrolled: false };
        return {
            enrolled: true,
            sampleCount: profile.sampleCount,
            seconds: profile.seconds,
            consentAt: profile.consentAt,
            updatedAt: profile.updatedAt,
        };
    }

    /** Đăng ký (hoặc đăng ký lại) giọng từ các mẫu đọc; bắt buộc đã đồng ý. */
    async enroll(userId: string, samples: Buffer[], consent: boolean) {
        if (!consent) throw ApiError.BadRequest("error-voice-consent-required");
        if (samples.length < VOICE_MIN_SAMPLES || samples.length > VOICE_MAX_SAMPLES) {
            throw ApiError.BadRequest("error-voice-sample-count");
        }
        const { embedding, seconds, model } = await this.voiceAi.embed(samples);
        const data = { embedding, seconds, model, sampleCount: samples.length, consentAt: new Date() };
        const existing = await this.voiceProfileRepository.getOne({ userId });
        if (existing) await this.voiceProfileRepository.updateById(existing._id, data);
        else await this.voiceProfileRepository.create({ userId, ...data });
        return this.status(userId);
    }

    /** Xoá hẳn vân giọng (không giữ bản mềm). */
    async remove(userId: string) {
        await this.voiceProfileRepository.deleteOne({ userId });
        return { enrolled: false };
    }

    /** Vân giọng của những người đã đăng ký trong danh sách, gửi kèm lệnh phiên âm. */
    async profilesFor(userIds: string[]) {
        if (!userIds.length) return [];
        const profiles = await this.voiceProfileRepository.getMany({ userId: { $in: userIds } });
        return profiles.map((p) => ({ userId: p.userId, embedding: p.embedding }));
    }
}
