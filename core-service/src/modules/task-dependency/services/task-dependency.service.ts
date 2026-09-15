import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { TaskDependency } from "../entities/task-dependency.entity";
import { TaskDependencyRepository } from "../repositories/task-dependency-repository.interface";

@Injectable()
export class TaskDependencyService extends BaseService<TaskDependency, TaskDependencyRepository> {
    constructor(
        @InjectRepository(Entity.TASK_DEPENDENCY)
        private readonly taskDependencyRepository: TaskDependencyRepository,
    ) {
        super(taskDependencyRepository);
    }
}
