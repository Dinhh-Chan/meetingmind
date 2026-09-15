import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateActionItemHistoryDto } from "../dto/create-action-item-history.dto";
import { ActionItemHistoryConditionDto } from "../dto/action-item-history-condition.dto";
import { UpdateActionItemHistoryDto } from "../dto/update-action-item-history.dto";
import { ActionItemHistory } from "../entities/action-item-history.entity";
import { ActionItemHistoryService } from "../services/action-item-history.service";

@Controller("action-item-history")
@ApiTags("action-item-history")
export class ActionItemHistoryController extends BaseControllerFactory<ActionItemHistory>(
    ActionItemHistory,
    ActionItemHistoryConditionDto,
    CreateActionItemHistoryDto,
    UpdateActionItemHistoryDto,
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
    constructor(private readonly actionItemHistoryService: ActionItemHistoryService) {
        super(actionItemHistoryService);
    }
}
