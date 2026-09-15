import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { OauthAccount } from "../entities/oauth-account.entity";
import { OauthAccountRepository } from "../repositories/oauth-account-repository.interface";

@Injectable()
export class OauthAccountService extends BaseService<OauthAccount, OauthAccountRepository> {
    constructor(
        @InjectRepository(Entity.OAUTH_ACCOUNT)
        private readonly oauthAccountRepository: OauthAccountRepository,
    ) {
        super(oauthAccountRepository);
    }
}
