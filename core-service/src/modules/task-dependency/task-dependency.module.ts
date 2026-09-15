import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { TaskDependencyController } from "./controllers/task-dependency.controller";
import { TaskDependencySqlRepository } from "./repositories/task-dependency-sql.repository";
import { TaskDependencyService } from "./services/task-dependency.service";

@Module({
    controllers: [TaskDependencyController],
    providers: [
        TaskDependencyService,
        RepositoryProvider(Entity.TASK_DEPENDENCY, TaskDependencySqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [TaskDependencyService],
})
export class TaskDependencyModule {}
