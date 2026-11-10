import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { SystemRole } from "@module/user/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateTranscriptVersionDto } from "../dto/create-transcript-version.dto";
import { TranscriptVersionConditionDto } from "../dto/transcript-version-condition.dto";
import { UpdateTranscriptVersionDto } from "../dto/update-transcript-version.dto";
import { TranscriptVersion } from "../entities/transcript-version.entity";
import { TranscriptVersionService } from "../services/transcript-version.service";

@Controller("transcript-version")
@ApiTags("transcript-version")
export class TranscriptVersionController extends BaseControllerFactory<TranscriptVersion>(
    TranscriptVersion,
    TranscriptVersionConditionDto,
    CreateTranscriptVersionDto,
    UpdateTranscriptVersionDto,
    {
        import: { enable: false },
        // Đọc thô bản ghi/biên bản của mọi người ghi: chỉ quản trị nền tảng.
        // Giao diện đọc qua /workflow/meetings/:id/content (lọc theo người xem).
        routes: {
            getMany: { roles: [SystemRole.SUPER_ADMIN] },
            getPage: { roles: [SystemRole.SUPER_ADMIN] },
            getOne: { roles: [SystemRole.SUPER_ADMIN] },
            getById: { roles: [SystemRole.SUPER_ADMIN] },
            exportDefinition: { roles: [SystemRole.SUPER_ADMIN] },
            exportXlsx: { roles: [SystemRole.SUPER_ADMIN] },
            create: { permission: Permission.TRANSCRIPT_UPDATE },
            upsert: { permission: Permission.TRANSCRIPT_UPDATE },
            getOneOrUpsert: { permission: Permission.TRANSCRIPT_UPDATE },
            updateById: { permission: Permission.TRANSCRIPT_UPDATE },
            updateByIds: { permission: Permission.TRANSCRIPT_UPDATE },
            deleteById: { permission: Permission.AI_RERUN },
            deleteByIds: { permission: Permission.AI_RERUN },
        },
    },
) {
    constructor(private readonly transcriptVersionService: TranscriptVersionService) {
        super(transcriptVersionService);
    }
}
