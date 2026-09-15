import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly transcriptSegmentService: TranscriptSegmentService) {
        super(transcriptSegmentService);
    }
}
