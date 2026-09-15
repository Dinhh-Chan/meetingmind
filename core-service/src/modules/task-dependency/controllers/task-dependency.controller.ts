import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.TASK_VIEW },
            getPage: { permission: Permission.TASK_VIEW },
            getOne: { permission: Permission.TASK_VIEW },
            getById: { permission: Permission.TASK_VIEW },
            exportDefinition: { permission: Permission.TASK_VIEW },
            exportXlsx: { permission: Permission.TASK_VIEW },
            create: { permission: Permission.TASK_UPDATE },
            upsert: { permission: Permission.TASK_UPDATE },
            getOneOrUpsert: { permission: Permission.TASK_UPDATE },
            updateById: { permission: Permission.TASK_UPDATE },
            updateByIds: { permission: Permission.TASK_UPDATE },
            deleteById: { permission: Permission.TASK_UPDATE },
            deleteByIds: { permission: Permission.TASK_UPDATE },
        },
    },
) {
    constructor(private readonly taskDependencyService: TaskDependencyService) {
        super(taskDependencyService);
    }
}
