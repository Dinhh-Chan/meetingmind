import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly recordingConsentService: RecordingConsentService) {
        super(recordingConsentService);
    }
}
