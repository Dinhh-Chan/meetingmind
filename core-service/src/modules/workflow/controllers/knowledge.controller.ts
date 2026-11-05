import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { DOCUMENT_MAX_BYTES } from "@module/media-file/services/media-file-upload.service";
import { User } from "@module/user/entities/user.entity";
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from "class-validator";
import { KnowledgeService } from "../services/knowledge.service";

/* ----------------------------------------------------------------- DTO */
// Khai trước controller: decorator đọc các lớp này ngay lúc định nghĩa class.

class HistoryTurnDto {
    @IsIn(["user", "assistant"])
    role: "user" | "assistant";

    @IsString()
    @MaxLength(4000)
    content: string;
}

export class KnowledgeAskBodyDto {
    @IsString()
    workspaceId: string;

    @IsString()
    @MaxLength(2000)
    question: string;

    /** Vài lượt hỏi đáp gần nhất để hiểu câu hỏi nối tiếp; Core chỉ giữ 6 lượt cuối. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => HistoryTurnDto)
    history?: HistoryTurnDto[];
}

export class WorkspaceBodyDto {
    @IsString()
    workspaceId: string;
}

/* ---------------------------------------------------------- controller */

/**
 * Hỏi đáp tri thức và tài liệu cuộc họp. Cùng tiền tố `workflow` và cùng cách
 * xét quyền với WorkflowController: service tự kiểm qua `PermissionService`
 * vì cần lọc theo từng cuộc họp.
 */
@Controller("workflow")
@ApiTags("workflow")
@Authorization()
export class KnowledgeController {
    constructor(private readonly knowledgeService: KnowledgeService) {}

    @Post("knowledge/ask")
    ask(@ReqUser() user: User, @Body() dto: KnowledgeAskBodyDto) {
        return this.knowledgeService.ask(user._id, dto);
    }

    @Get("knowledge/sources")
    sources(@ReqUser() user: User, @Query("workspaceId") workspaceId: string) {
        return this.knowledgeService.sources(user._id, workspaceId);
    }

    /** Owner/Admin: phát lại lệnh lập chỉ mục cho cả workspace. */
    @Post("knowledge/reindex")
    reindex(@ReqUser() user: User, @Body() dto: WorkspaceBodyDto) {
        return this.knowledgeService.reindex(user._id, dto.workspaceId);
    }

    /* tài liệu cuộc họp */

    @Get("meetings/:id/documents")
    listDocuments(@ReqUser() user: User, @Param("id") id: string) {
        return this.knowledgeService.listDocuments(user._id, id);
    }

    @Post("meetings/:id/documents")
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: { file: { type: "string", format: "binary" } },
        },
    })
    // Multer chặn cứng ở mức rộng hơn một chút để tệp vừa quá 20 MB vẫn nhận
    // được thông báo tiếng Việt từ service thay vì "File too large".
    @UseInterceptors(
        FileInterceptor("file", {
            limits: { fileSize: DOCUMENT_MAX_BYTES + 5 * 1024 * 1024 },
        }),
    )
    uploadDocument(
        @ReqUser() user: User,
        @Param("id") id: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.knowledgeService.uploadDocument(user._id, id, file);
    }

    @Delete("documents/:fileId")
    deleteDocument(@ReqUser() user: User, @Param("fileId") fileId: string) {
        return this.knowledgeService.deleteDocument(user._id, fileId);
    }
}
