import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { TaskDependency } from "../entities/task-dependency.entity";

export type TaskDependencyRepository = BaseRepository<TaskDependency>;
