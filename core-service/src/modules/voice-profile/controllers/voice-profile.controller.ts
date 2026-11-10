import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { User } from "@module/user/entities/user.entity";
import { Body, Controller, Delete, Get, Param, Post, Res, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { Response } from "express";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import multer from "multer";
import { VOICE_MAX_SAMPLES, VoiceProfileService } from "../services/voice-profile.service";

/**
 * Giọng nói của chính mình: xem trạng thái, đăng ký bằng vài mẫu đọc, nghe
 * lại, xoá. Mẫu đọc được lưu để admin nghe khi xác nhận.
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
            (files ?? []).map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
            consent === "true",
        );
    }

    @Get("samples/:index")
    async sample(@ReqUser() user: User, @Param("index") index: string, @Res() res: Response) {
        const { stream, mimetype } = await this.voiceProfileService.sample(user._id, Number(index));
        res.setHeader("Content-Type", mimetype);
        stream.pipe(res);
    }

    @Delete()
    remove(@ReqUser() user: User) {
        return this.voiceProfileService.remove(user._id);
    }
}
