import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ActionItemCitationController } from "./controllers/action-item-citation.controller";
import { ActionItemCitationSqlRepository } from "./repositories/action-item-citation-sql.repository";
import { ActionItemCitationService } from "./services/action-item-citation.service";

@Module({
    controllers: [ActionItemCitationController],
    providers: [
        ActionItemCitationService,
        RepositoryProvider(Entity.ACTION_ITEM_CITATION, ActionItemCitationSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ActionItemCitationService],
})
export class ActionItemCitationModule {}
