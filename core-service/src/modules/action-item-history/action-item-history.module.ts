import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ActionItemHistoryController } from "./controllers/action-item-history.controller";
import { ActionItemHistorySqlRepository } from "./repositories/action-item-history-sql.repository";
import { ActionItemHistoryService } from "./services/action-item-history.service";

@Module({
    controllers: [ActionItemHistoryController],
    providers: [
        ActionItemHistoryService,
        RepositoryProvider(Entity.ACTION_ITEM_HISTORY, ActionItemHistorySqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ActionItemHistoryService],
})
export class ActionItemHistoryModule {}
