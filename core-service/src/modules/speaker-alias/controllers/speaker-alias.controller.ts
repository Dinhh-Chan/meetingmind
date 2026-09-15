import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateSpeakerAliasDto } from "../dto/create-speaker-alias.dto";
import { SpeakerAliasConditionDto } from "../dto/speaker-alias-condition.dto";
import { UpdateSpeakerAliasDto } from "../dto/update-speaker-alias.dto";
import { SpeakerAlias } from "../entities/speaker-alias.entity";
import { SpeakerAliasService } from "../services/speaker-alias.service";

@Controller("speaker-alias")
@ApiTags("speaker-alias")
export class SpeakerAliasController extends BaseControllerFactory<SpeakerAlias>(
    SpeakerAlias,
    SpeakerAliasConditionDto,
    CreateSpeakerAliasDto,
    UpdateSpeakerAliasDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly speakerAliasService: SpeakerAliasService) {
        super(speakerAliasService);
    }
}
