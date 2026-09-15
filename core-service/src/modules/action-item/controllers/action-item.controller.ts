import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly actionItemService: ActionItemService) {
        super(actionItemService);
    }
}
