import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { TaskDependency } from "../entities/task-dependency.entity";
import { TaskDependencyModel } from "../models/task-dependency.model";
import { TaskDependencyRepository } from "./task-dependency-repository.interface";

@Injectable()
export class TaskDependencySqlRepository
    extends SqlRepository<TaskDependency>
    implements TaskDependencyRepository
{
    constructor(
        @InjectModel(TaskDependencyModel)
        private readonly taskDependencyModel: ModelCtor<TaskDependencyModel>,
    ) {
        super(taskDependencyModel);
    }
}
