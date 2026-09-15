import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { UserSessionController } from "./controllers/user-session.controller";
import { UserSessionSqlRepository } from "./repositories/user-session-sql.repository";
import { UserSessionService } from "./services/user-session.service";

@Module({
    controllers: [UserSessionController],
    providers: [
        UserSessionService,
        RepositoryProvider(Entity.USER_SESSION, UserSessionSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [UserSessionService],
})
export class UserSessionModule {}
