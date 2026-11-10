import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ClarificationRequestSqlRepository } from "./repositories/clarification-request-sql.repository";
import { ClarificationRequestService } from "./services/clarification-request.service";

@Module({
    providers: [
        ClarificationRequestService,
        RepositoryProvider(Entity.CLARIFICATION_REQUEST, ClarificationRequestSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ClarificationRequestService],
})
export class ClarificationRequestModule {}
