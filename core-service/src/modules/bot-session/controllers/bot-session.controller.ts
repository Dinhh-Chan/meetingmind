import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateBotSessionDto } from "../dto/create-bot-session.dto";
import { BotSessionConditionDto } from "../dto/bot-session-condition.dto";
import { UpdateBotSessionDto } from "../dto/update-bot-session.dto";
import { BotSession } from "../entities/bot-session.entity";
import { BotSessionService } from "../services/bot-session.service";

@Controller("bot-session")
@ApiTags("bot-session")
export class BotSessionController extends BaseControllerFactory<BotSession>(
    BotSession,
    BotSessionConditionDto,
    CreateBotSessionDto,
    UpdateBotSessionDto,
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
    constructor(private readonly botSessionService: BotSessionService) {
        super(botSessionService);
    }
}
