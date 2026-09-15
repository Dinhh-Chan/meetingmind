import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { BotSessionController } from "./controllers/bot-session.controller";
import { BotSessionSqlRepository } from "./repositories/bot-session-sql.repository";
import { BotSessionService } from "./services/bot-session.service";

@Module({
    controllers: [BotSessionController],
    providers: [
        BotSessionService,
        RepositoryProvider(Entity.BOT_SESSION, BotSessionSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [BotSessionService],
})
export class BotSessionModule {}
