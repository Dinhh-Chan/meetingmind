import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { OauthAccount } from "../entities/oauth-account.entity";
import { OauthAccountModel } from "../models/oauth-account.model";
import { OauthAccountRepository } from "./oauth-account-repository.interface";

@Injectable()
export class OauthAccountSqlRepository
    extends SqlRepository<OauthAccount>
    implements OauthAccountRepository
{
    constructor(
        @InjectModel(OauthAccountModel)
        private readonly oauthAccountModel: ModelCtor<OauthAccountModel>,
    ) {
        super(oauthAccountModel);
    }
}
