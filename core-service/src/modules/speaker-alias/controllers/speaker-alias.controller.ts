import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
    constructor(private readonly speakerAliasService: SpeakerAliasService) {
        super(speakerAliasService);
    }
}
