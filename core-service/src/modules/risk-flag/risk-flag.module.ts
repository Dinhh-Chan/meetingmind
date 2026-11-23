import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { ActionItemModule } from "@module/action-item/action-item.module";
import { TaskDependencyModule } from "@module/task-dependency/task-dependency.module";
import { UserModule } from "@module/user/user.module";
import { WorkspaceModule } from "@module/workspace/workspace.module";
import { Module } from "@nestjs/common";
import { RiskFlagController } from "./controllers/risk-flag.controller";
import { RiskController } from "./controllers/risk.controller";
import { RiskFlagSqlRepository } from "./repositories/risk-flag-sql.repository";
import { RiskDetectorService } from "./services/risk-detector.service";
import { RiskFlagService } from "./services/risk-flag.service";

@Module({
    imports: [ActionItemModule, TaskDependencyModule, UserModule, WorkspaceModule],
    controllers: [RiskFlagController, RiskController],
    providers: [
        RiskFlagService,
        RiskDetectorService,
        RepositoryProvider(Entity.RISK_FLAG, RiskFlagSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [RiskFlagService, RiskDetectorService],
})
export class RiskFlagModule {}
