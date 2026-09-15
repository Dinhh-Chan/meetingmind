import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateTaskDependencyDto } from "../dto/create-task-dependency.dto";
import { TaskDependencyConditionDto } from "../dto/task-dependency-condition.dto";
import { UpdateTaskDependencyDto } from "../dto/update-task-dependency.dto";
import { TaskDependency } from "../entities/task-dependency.entity";
import { TaskDependencyService } from "../services/task-dependency.service";

@Controller("task-dependency")
@ApiTags("task-dependency")
export class TaskDependencyController extends BaseControllerFactory<TaskDependency>(
    TaskDependency,
    TaskDependencyConditionDto,
    CreateTaskDependencyDto,
    UpdateTaskDependencyDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly taskDependencyService: TaskDependencyService) {
        super(taskDependencyService);
    }
}
