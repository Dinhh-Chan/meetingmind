import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { BotSession } from "../entities/bot-session.entity";
import { BotSessionRepository } from "../repositories/bot-session-repository.interface";

@Injectable()
export class BotSessionService extends BaseService<BotSession, BotSessionRepository> {
    constructor(
        @InjectRepository(Entity.BOT_SESSION)
        private readonly botSessionRepository: BotSessionRepository,
    ) {
        super(botSessionRepository);
    }
}
