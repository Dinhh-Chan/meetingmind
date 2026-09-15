import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { BotSession } from "../entities/bot-session.entity";
import { BotSessionModel } from "../models/bot-session.model";
import { BotSessionRepository } from "./bot-session-repository.interface";

@Injectable()
export class BotSessionSqlRepository
    extends SqlRepository<BotSession>
    implements BotSessionRepository
{
    constructor(
        @InjectModel(BotSessionModel)
        private readonly botSessionModel: ModelCtor<BotSessionModel>,
    ) {
        super(botSessionModel);
    }
}
