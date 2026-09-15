import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly botSessionService: BotSessionService) {
        super(botSessionService);
    }
}
