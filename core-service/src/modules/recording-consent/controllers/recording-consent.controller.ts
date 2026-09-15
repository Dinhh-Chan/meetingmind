import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateRecordingConsentDto } from "../dto/create-recording-consent.dto";
import { RecordingConsentConditionDto } from "../dto/recording-consent-condition.dto";
import { UpdateRecordingConsentDto } from "../dto/update-recording-consent.dto";
import { RecordingConsent } from "../entities/recording-consent.entity";
import { RecordingConsentService } from "../services/recording-consent.service";

@Controller("recording-consent")
@ApiTags("recording-consent")
export class RecordingConsentController extends BaseControllerFactory<RecordingConsent>(
    RecordingConsent,
    RecordingConsentConditionDto,
    CreateRecordingConsentDto,
    UpdateRecordingConsentDto,
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
    constructor(private readonly recordingConsentService: RecordingConsentService) {
        super(recordingConsentService);
    }
}
