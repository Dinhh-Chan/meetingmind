import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { User } from "@module/user/entities/user.entity";
import { Body, Controller, Delete, Get, Post, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import multer from "multer";
import { VOICE_MAX_SAMPLES, VoiceProfileService } from "../services/voice-profile.service";

/**
 * Giọng nói của chính mình: xem trạng thái, đăng ký bằng vài mẫu đọc, xoá.
 * Mẫu ghi âm chỉ nằm trong bộ nhớ khi tính vân giọng, không được lưu.
 */
@Controller("me/voice")
@ApiTags("me")
@Authorization()
export class VoiceProfileController {
    constructor(private readonly voiceProfileService: VoiceProfileService) {}

    @Get()
    status(@ReqUser() user: User) {
        return this.voiceProfileService.status(user._id);
    }

    @Post()
    @UseInterceptors(
        FilesInterceptor("samples", VOICE_MAX_SAMPLES, {
            storage: multer.memoryStorage(),
            limits: { fileSize: 8 * 1024 * 1024, files: VOICE_MAX_SAMPLES },
        }),
    )
    enroll(
        @ReqUser() user: User,
        @UploadedFiles() files: Express.Multer.File[],
        @Body("consent") consent: string,
    ) {
        return this.voiceProfileService.enroll(
            user._id,
            (files ?? []).map((f) => f.buffer),
            consent === "true",
        );
    }

    @Delete()
    remove(@ReqUser() user: User) {
        return this.voiceProfileService.remove(user._id);
    }
}
