import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { Permission } from "@module/permission/common/constant";
import { RequirePermission } from "@module/permission/common/decorator";
import { User } from "@module/user/entities/user.entity";
import { Body, Controller, Headers, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import multer from "multer";
import { ApiError } from "@config/exception/api-error";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import { LiveTranscriptService } from "../services/live-transcript.service";
import { MeetingProcessingService } from "../services/meeting-processing.service";

/* ----------------------------------------------------------------- DTO */
// Khai trước controller: decorator đọc các lớp này ngay lúc định nghĩa class.

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

export class StartLiveSessionBodyDto {
    @IsString()
    workspaceId: string;

    @IsString()
    meetingUrl: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsString()
    platform?: string;
}

export class LiveSegmentDto {
    @IsString()
    speakerLabel: string;

    @IsOptional()
    @IsString()
    displayName?: string;

    @IsInt()
    startMs: number;

    @IsInt()
    endMs: number;

    @IsString()
    text: string;
}

export class AppendLiveTranscriptBodyDto {
    @IsString()
    workspaceId: string;

    @IsString()
    meetingId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LiveSegmentDto)
    segments: LiveSegmentDto[];
}

export class FinalizeLiveTranscriptBodyDto {
    @IsString()
    workspaceId: string;

    @IsString()
    meetingId: string;
}

/* ---------------------------------------------------------- controller */

@Controller("meeting-processing")
@ApiTags("meeting-processing")
@Authorization()
export class MeetingProcessingController {
    constructor(
        private readonly meetingProcessingService: MeetingProcessingService,
        private readonly liveTranscriptService: LiveTranscriptService,
    ) {}

    /** Khởi động luồng xử lý cho một bản ghi đã nằm trên MinIO. */
    @Post("transcribe")
    @RequirePermission(Permission.RECORDING_CREATE)
    async transcribe(@ReqUser() user: User, @Body() dto: StartTranscriptionBodyDto) {
        return this.meetingProcessingService.startTranscription({
            ...dto,
            recordedById: user._id,
        });
    }

    /**
     * Ghi âm trên trình duyệt: một câu vừa phiên âm xong (wav ngắn) → vân giọng
     * và người tham dự khớp giọng. Phạm vi cuộc họp gửi qua header x-meeting-id
     * vì multer chạy sau guard.
     */
    @Post("live-speaker")
    @RequirePermission(Permission.RECORDING_CREATE)
    @UseInterceptors(
        FileInterceptor("audio", {
            storage: multer.memoryStorage(),
            limits: { fileSize: 2 * 1024 * 1024, files: 1 },
        }),
    )
    async identifyLiveSpeaker(
        @UploadedFile() file: Express.Multer.File,
        @Headers("x-meeting-id") meetingId: string,
    ) {
        if (!file?.buffer?.length || !meetingId) {
            throw ApiError.BadRequest("error-voice-sample-invalid", { reason: "thiếu đoạn âm thanh" });
        }
        return this.meetingProcessingService.identifyLiveSpeaker(meetingId, file.buffer);
    }

    /** Ghi âm trên trình duyệt, nhận dạng bằng máy chủ: một câu (wav) → chữ + người nói. */
    @Post("live-utterance")
    @RequirePermission(Permission.RECORDING_CREATE)
    @UseInterceptors(
        FileInterceptor("audio", {
            storage: multer.memoryStorage(),
            limits: { fileSize: 2 * 1024 * 1024, files: 1 },
        }),
    )
    async liveUtterance(
        @UploadedFile() file: Express.Multer.File,
        @Headers("x-meeting-id") meetingId: string,
    ) {
        if (!file?.buffer?.length || !meetingId) {
            throw ApiError.BadRequest("error-voice-sample-invalid", { reason: "thiếu đoạn âm thanh" });
        }
        return this.meetingProcessingService.liveUtterance(meetingId, file.buffer);
    }

    /* ------------------------------------------- transcript trực tiếp */

    /**
     * Extension bấm một nút trong phòng họp: tìm cuộc họp theo link, chưa có
     * thì tạo. Trả về meetingId để các lần đẩy phụ đề sau dùng.
     */
    @Post("live-session/start")
    @RequirePermission(Permission.MEETING_CREATE)
    async startLiveSession(
        @ReqUser() user: User,
        @Body() dto: StartLiveSessionBodyDto,
    ) {
        return this.liveTranscriptService.startSession({
            ...dto,
            createdById: user._id,
        });
    }

    /** Đẩy một lô đoạn phụ đề. Gọi nhiều lần trong lúc họp. */
    @Post("live-transcript")
    @RequirePermission(Permission.RECORDING_CREATE)
    async appendLiveTranscript(
        @ReqUser() user: User,
        @Body() dto: AppendLiveTranscriptBodyDto,
    ) {
        return this.liveTranscriptService.appendSegments(
            dto.meetingId,
            dto.segments,
            user._id,
        );
    }

    /** Kết thúc họp: chốt phiên bản transcript và xin AI phân tích. */
    @Post("live-transcript/finalize")
    @RequirePermission(Permission.RECORDING_CREATE)
    async finalizeLiveTranscript(
        @ReqUser() user: User,
        @Body() dto: FinalizeLiveTranscriptBodyDto,
    ) {
        return this.liveTranscriptService.finalize(dto.meetingId, user._id);
    }
}
