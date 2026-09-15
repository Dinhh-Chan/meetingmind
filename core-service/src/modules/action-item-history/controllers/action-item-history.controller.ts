import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly actionItemHistoryService: ActionItemHistoryService) {
        super(actionItemHistoryService);
    }
}
