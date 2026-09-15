import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { WorkspaceController } from "./controllers/workspace.controller";
import { WorkspaceSqlRepository } from "./repositories/workspace-sql.repository";
import { WorkspaceService } from "./services/workspace.service";

@Module({
    controllers: [WorkspaceController],
    providers: [
        WorkspaceService,
        RepositoryProvider(Entity.WORKSPACE, WorkspaceSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [WorkspaceService],
})
export class WorkspaceModule {}
