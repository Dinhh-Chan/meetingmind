import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { AgendaItemController } from "./controllers/agenda-item.controller";
import { AgendaItemSqlRepository } from "./repositories/agenda-item-sql.repository";
import { AgendaItemService } from "./services/agenda-item.service";

@Module({
    controllers: [AgendaItemController],
    providers: [
        AgendaItemService,
        RepositoryProvider(Entity.AGENDA_ITEM, AgendaItemSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [AgendaItemService],
})
export class AgendaItemModule {}
