import { OmitType } from "@nestjs/swagger";
import { TaskDependency } from "../entities/task-dependency.entity";

export class CreateTaskDependencyDto extends OmitType(TaskDependency, ["_id"] as const) {}
