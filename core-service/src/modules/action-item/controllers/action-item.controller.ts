import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateActionItemDto } from "../dto/create-action-item.dto";
import { ActionItemConditionDto } from "../dto/action-item-condition.dto";
import { UpdateActionItemDto } from "../dto/update-action-item.dto";
import { ActionItem } from "../entities/action-item.entity";
import { ActionItemService } from "../services/action-item.service";

@Controller("action-item")
@ApiTags("action-item")
export class ActionItemController extends BaseControllerFactory<ActionItem>(
    ActionItem,
    ActionItemConditionDto,
    CreateActionItemDto,
    UpdateActionItemDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.TASK_VIEW },
            getPage: { permission: Permission.TASK_VIEW },
            getOne: { permission: Permission.TASK_VIEW },
            getById: { permission: Permission.TASK_VIEW },
            exportDefinition: { permission: Permission.TASK_VIEW },
            exportXlsx: { permission: Permission.TASK_VIEW },
            create: { permission: Permission.TASK_CREATE },
            upsert: { permission: Permission.TASK_CREATE },
            getOneOrUpsert: { permission: Permission.TASK_CREATE },
            updateById: { permission: Permission.TASK_UPDATE },
            updateByIds: { permission: Permission.TASK_UPDATE },
            deleteById: { permission: Permission.TASK_DELETE },
            deleteByIds: { permission: Permission.TASK_DELETE },
        },
    },
) {
    constructor(private readonly actionItemService: ActionItemService) {
        super(actionItemService);
    }
}
