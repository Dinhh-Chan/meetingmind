import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { IntegrationSqlRepository } from "./repositories/integration-sql.repository";
import { IntegrationService } from "./services/integration.service";

@Module({
    providers: [
        IntegrationService,
        RepositoryProvider(Entity.INTEGRATION, IntegrationSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [IntegrationService],
})
export class IntegrationModule {}
