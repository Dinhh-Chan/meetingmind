import { PartialType } from "@nestjs/swagger";
import { OauthAccount } from "../entities/oauth-account.entity";

export class OauthAccountConditionDto extends PartialType(OauthAccount) {}
