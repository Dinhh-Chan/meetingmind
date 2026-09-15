import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { WorkspaceSettingController } from "./controllers/workspace-setting.controller";
import { WorkspaceSettingSqlRepository } from "./repositories/workspace-setting-sql.repository";
import { WorkspaceSettingService } from "./services/workspace-setting.service";

@Module({
    controllers: [WorkspaceSettingController],
    providers: [
        WorkspaceSettingService,
        RepositoryProvider(Entity.WORKSPACE_SETTING, WorkspaceSettingSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [WorkspaceSettingService],
})
export class WorkspaceSettingModule {}
