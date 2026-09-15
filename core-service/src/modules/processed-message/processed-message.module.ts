import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ProcessedMessageController } from "./controllers/processed-message.controller";
import { ProcessedMessageSqlRepository } from "./repositories/processed-message-sql.repository";
import { ProcessedMessageService } from "./services/processed-message.service";

@Module({
    controllers: [ProcessedMessageController],
    providers: [
        ProcessedMessageService,
        RepositoryProvider(Entity.PROCESSED_MESSAGE, ProcessedMessageSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ProcessedMessageService],
})
export class ProcessedMessageModule {}
