import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.TRANSCRIPT_VIEW },
            getPage: { permission: Permission.TRANSCRIPT_VIEW },
            getOne: { permission: Permission.TRANSCRIPT_VIEW },
            getById: { permission: Permission.TRANSCRIPT_VIEW },
            exportDefinition: { permission: Permission.TRANSCRIPT_VIEW },
            exportXlsx: { permission: Permission.TRANSCRIPT_VIEW },
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
