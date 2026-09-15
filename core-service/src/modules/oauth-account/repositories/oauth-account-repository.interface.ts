import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { OauthAccount } from "../entities/oauth-account.entity";

export type OauthAccountRepository = BaseRepository<OauthAccount>;
