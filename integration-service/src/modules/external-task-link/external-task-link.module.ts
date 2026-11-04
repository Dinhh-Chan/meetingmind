import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ExternalTaskLinkSqlRepository } from "./repositories/external-task-link-sql.repository";
import { ExternalTaskLinkService } from "./services/external-task-link.service";

@Module({
    providers: [
        ExternalTaskLinkService,
        RepositoryProvider(
            Entity.EXTERNAL_TASK_LINK,
            ExternalTaskLinkSqlRepository,
        ),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ExternalTaskLinkService],
})
export class ExternalTaskLinkModule {}
