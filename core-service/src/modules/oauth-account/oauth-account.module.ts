import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { OauthAccountController } from "./controllers/oauth-account.controller";
import { OauthAccountSqlRepository } from "./repositories/oauth-account-sql.repository";
import { OauthAccountService } from "./services/oauth-account.service";

@Module({
    controllers: [OauthAccountController],
    providers: [
        OauthAccountService,
        RepositoryProvider(Entity.OAUTH_ACCOUNT, OauthAccountSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [OauthAccountService],
})
export class OauthAccountModule {}
