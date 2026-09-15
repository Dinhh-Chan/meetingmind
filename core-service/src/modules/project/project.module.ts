import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ProjectController } from "./controllers/project.controller";
import { ProjectSqlRepository } from "./repositories/project-sql.repository";
import { ProjectService } from "./services/project.service";

@Module({
    controllers: [ProjectController],
    providers: [
        ProjectService,
        RepositoryProvider(Entity.PROJECT, ProjectSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ProjectService],
})
export class ProjectModule {}
