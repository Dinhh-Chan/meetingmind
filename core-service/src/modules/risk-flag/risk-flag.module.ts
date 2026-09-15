import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { RiskFlagController } from "./controllers/risk-flag.controller";
import { RiskFlagSqlRepository } from "./repositories/risk-flag-sql.repository";
import { RiskFlagService } from "./services/risk-flag.service";

@Module({
    controllers: [RiskFlagController],
    providers: [
        RiskFlagService,
        RepositoryProvider(Entity.RISK_FLAG, RiskFlagSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [RiskFlagService],
})
export class RiskFlagModule {}
