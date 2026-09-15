import { PartialType } from "@nestjs/swagger";
import { TaskDependency } from "../entities/task-dependency.entity";

export class TaskDependencyConditionDto extends PartialType(TaskDependency) {}
