import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ActionItemController } from "./controllers/action-item.controller";
import { ActionItemSqlRepository } from "./repositories/action-item-sql.repository";
import { ActionItemService } from "./services/action-item.service";

@Module({
    controllers: [ActionItemController],
    providers: [
        ActionItemService,
        RepositoryProvider(Entity.ACTION_ITEM, ActionItemSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ActionItemService],
})
export class ActionItemModule {}
