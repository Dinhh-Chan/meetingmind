import { Authorization } from "@common/decorator/auth.decorator";
import { Permission } from "@module/permission/common/constant";
import { RequirePermission } from "@module/permission/common/decorator";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { MeetingProcessingService } from "../services/meeting-processing.service";

export class StartTranscriptionBodyDto {
    @IsString()
    workspaceId: string;

    @IsString()
    meetingId: string;

    @IsString()
    bucket: string;

    @IsString()
    objectKey: string;

    @IsOptional()
    @IsString()
    fileId?: string;
}

@Controller("meeting-processing")
@ApiTags("meeting-processing")
@Authorization()
export class MeetingProcessingController {
    constructor(
        private readonly meetingProcessingService: MeetingProcessingService,
    ) {}

    /** Khởi động luồng xử lý cho một bản ghi đã nằm trên MinIO. */
    @Post("transcribe")
    @RequirePermission(Permission.MEETING_RECORDING_CONTROL)
    async transcribe(@Body() dto: StartTranscriptionBodyDto) {
        return this.meetingProcessingService.startTranscription(dto);
    }
}
