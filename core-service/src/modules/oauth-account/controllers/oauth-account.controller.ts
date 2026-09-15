import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateOauthAccountDto } from "../dto/create-oauth-account.dto";
import { OauthAccountConditionDto } from "../dto/oauth-account-condition.dto";
import { UpdateOauthAccountDto } from "../dto/update-oauth-account.dto";
import { OauthAccount } from "../entities/oauth-account.entity";
import { OauthAccountService } from "../services/oauth-account.service";

@Controller("oauth-account")
@ApiTags("oauth-account")
export class OauthAccountController extends BaseControllerFactory<OauthAccount>(
    OauthAccount,
    OauthAccountConditionDto,
    CreateOauthAccountDto,
    UpdateOauthAccountDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly oauthAccountService: OauthAccountService) {
        super(oauthAccountService);
    }
}
