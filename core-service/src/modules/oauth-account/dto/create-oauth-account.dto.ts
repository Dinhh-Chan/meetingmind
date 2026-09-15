import { OmitType } from "@nestjs/swagger";
import { OauthAccount } from "../entities/oauth-account.entity";

export class CreateOauthAccountDto extends OmitType(OauthAccount, ["_id"] as const) {}
