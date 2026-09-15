import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { OutboxEventController } from "./controllers/outbox-event.controller";
import { OutboxEventSqlRepository } from "./repositories/outbox-event-sql.repository";
import { OutboxEventService } from "./services/outbox-event.service";

@Module({
    controllers: [OutboxEventController],
    providers: [
        OutboxEventService,
        RepositoryProvider(Entity.OUTBOX_EVENT, OutboxEventSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [OutboxEventService],
})
export class OutboxEventModule {}
