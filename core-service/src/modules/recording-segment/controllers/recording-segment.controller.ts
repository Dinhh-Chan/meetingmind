import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.MEETING_VIEW },
            getPage: { permission: Permission.MEETING_VIEW },
            getOne: { permission: Permission.MEETING_VIEW },
            getById: { permission: Permission.MEETING_VIEW },
            exportDefinition: { permission: Permission.MEETING_VIEW },
            exportXlsx: { permission: Permission.MEETING_VIEW },
            create: { permission: Permission.MEETING_RECORDING_CONTROL },
            upsert: { permission: Permission.MEETING_RECORDING_CONTROL },
            getOneOrUpsert: { permission: Permission.MEETING_RECORDING_CONTROL },
            updateById: { permission: Permission.MEETING_RECORDING_CONTROL },
            updateByIds: { permission: Permission.MEETING_RECORDING_CONTROL },
            deleteById: { permission: Permission.MEETING_RECORDING_CONTROL },
            deleteByIds: { permission: Permission.MEETING_RECORDING_CONTROL },
        },
    },
) {
    constructor(private readonly recordingSegmentService: RecordingSegmentService) {
        super(recordingSegmentService);
    }
}
