import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { DecisionCitationController } from "./controllers/decision-citation.controller";
import { DecisionCitationSqlRepository } from "./repositories/decision-citation-sql.repository";
import { DecisionCitationService } from "./services/decision-citation.service";

@Module({
    controllers: [DecisionCitationController],
    providers: [
        DecisionCitationService,
        RepositoryProvider(Entity.DECISION_CITATION, DecisionCitationSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [DecisionCitationService],
})
export class DecisionCitationModule {}
