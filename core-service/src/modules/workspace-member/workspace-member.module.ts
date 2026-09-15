import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { WorkspaceMemberController } from "./controllers/workspace-member.controller";
import { WorkspaceMemberSqlRepository } from "./repositories/workspace-member-sql.repository";
import { WorkspaceMemberService } from "./services/workspace-member.service";

@Module({
    controllers: [WorkspaceMemberController],
    providers: [
        WorkspaceMemberService,
        RepositoryProvider(Entity.WORKSPACE_MEMBER, WorkspaceMemberSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
