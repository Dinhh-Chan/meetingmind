import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ProjectMemberController } from "./controllers/project-member.controller";
import { ProjectMemberSqlRepository } from "./repositories/project-member-sql.repository";
import { ProjectMemberService } from "./services/project-member.service";

@Module({
    controllers: [ProjectMemberController],
    providers: [
        ProjectMemberService,
        RepositoryProvider(Entity.PROJECT_MEMBER, ProjectMemberSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
