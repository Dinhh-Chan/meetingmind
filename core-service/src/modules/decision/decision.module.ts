import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { DecisionController } from "./controllers/decision.controller";
import { DecisionSqlRepository } from "./repositories/decision-sql.repository";
import { DecisionService } from "./services/decision.service";

@Module({
    controllers: [DecisionController],
    providers: [
        DecisionService,
        RepositoryProvider(Entity.DECISION, DecisionSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [DecisionService],
})
export class DecisionModule {}
