import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly transcriptVersionService: TranscriptVersionService) {
        super(transcriptVersionService);
    }
}
