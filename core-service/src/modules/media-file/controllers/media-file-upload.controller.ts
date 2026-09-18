import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { Permission } from "@module/permission/common/constant";
import { RequirePermission } from "@module/permission/common/decorator";
import { User } from "@module/user/entities/user.entity";
import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { MediaFileUploadService } from "../services/media-file-upload.service";

export class UploadAudioDto {
    @IsString()
    workspaceId: string;

    @IsOptional()
    @IsString()
    meetingId?: string;
}

@Controller("media-file")
@ApiTags("media-file")
@Authorization()
export class MediaFileUploadController {
    constructor(
        private readonly mediaFileUploadService: MediaFileUploadService,
    ) {}

    /** Nhập bản ghi có sẵn — nguồn `upload` của MVP. */
    @Post("upload")
    @RequirePermission(Permission.MEETING_RECORDING_CONTROL)
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                file: { type: "string", format: "binary" },
                workspaceId: { type: "string" },
                meetingId: { type: "string" },
            },
        },
    })
    @UseInterceptors(FileInterceptor("file"))
    async upload(
        @ReqUser() user: User,
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadAudioDto,
    ) {
        return this.mediaFileUploadService.upload({
            workspaceId: dto.workspaceId,
            meetingId: dto.meetingId,
            originalName: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer,
            uploadedById: user?._id,
        });
    }

    /** URL tạm để nghe lại; chỉ cấp sau khi qua kiểm tra quyền. */
    @Get(":id/download-url")
    @RequirePermission(Permission.AUDIO_LISTEN)
    async downloadUrl(@Param("id") id: string) {
        return this.mediaFileUploadService.getDownloadUrl(id);
    }
}
