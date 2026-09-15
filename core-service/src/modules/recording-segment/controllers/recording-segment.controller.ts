import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateRecordingSegmentDto } from "../dto/create-recording-segment.dto";
import { RecordingSegmentConditionDto } from "../dto/recording-segment-condition.dto";
import { UpdateRecordingSegmentDto } from "../dto/update-recording-segment.dto";
import { RecordingSegment } from "../entities/recording-segment.entity";
import { RecordingSegmentService } from "../services/recording-segment.service";

@Controller("recording-segment")
@ApiTags("recording-segment")
export class RecordingSegmentController extends BaseControllerFactory<RecordingSegment>(
    RecordingSegment,
    RecordingSegmentConditionDto,
    CreateRecordingSegmentDto,
    UpdateRecordingSegmentDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly recordingSegmentService: RecordingSegmentService) {
        super(recordingSegmentService);
    }
}
