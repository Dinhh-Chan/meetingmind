import { PartialType } from "@nestjs/swagger";
import { CreateOauthAccountDto } from "./create-oauth-account.dto";

export class UpdateOauthAccountDto extends PartialType(CreateOauthAccountDto) {}
