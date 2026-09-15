import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { UserSession } from "../entities/user-session.entity";
import { UserSessionModel } from "../models/user-session.model";
import { UserSessionRepository } from "./user-session-repository.interface";

@Injectable()
export class UserSessionSqlRepository
    extends SqlRepository<UserSession>
    implements UserSessionRepository
{
    constructor(
        @InjectModel(UserSessionModel)
        private readonly userSessionModel: ModelCtor<UserSessionModel>,
    ) {
        super(userSessionModel);
    }
}
