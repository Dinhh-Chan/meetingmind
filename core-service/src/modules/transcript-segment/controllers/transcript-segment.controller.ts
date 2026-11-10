import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { SystemRole } from "@module/user/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateTranscriptSegmentDto } from "../dto/create-transcript-segment.dto";
import { TranscriptSegmentConditionDto } from "../dto/transcript-segment-condition.dto";
import { UpdateTranscriptSegmentDto } from "../dto/update-transcript-segment.dto";
import { TranscriptSegment } from "../entities/transcript-segment.entity";
import { TranscriptSegmentService } from "../services/transcript-segment.service";

@Controller("transcript-segment")
@ApiTags("transcript-segment")
export class TranscriptSegmentController extends BaseControllerFactory<TranscriptSegment>(
    TranscriptSegment,
    TranscriptSegmentConditionDto,
    CreateTranscriptSegmentDto,
    UpdateTranscriptSegmentDto,
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
            deleteById: { permission: Permission.TRANSCRIPT_UPDATE },
            deleteByIds: { permission: Permission.TRANSCRIPT_UPDATE },
        },
    },
) {
    constructor(private readonly transcriptSegmentService: TranscriptSegmentService) {
        super(transcriptSegmentService);
    }
}
