import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateActionItemCitationDto } from "../dto/create-action-item-citation.dto";
import { ActionItemCitationConditionDto } from "../dto/action-item-citation-condition.dto";
import { UpdateActionItemCitationDto } from "../dto/update-action-item-citation.dto";
import { ActionItemCitation } from "../entities/action-item-citation.entity";
import { ActionItemCitationService } from "../services/action-item-citation.service";

@Controller("action-item-citation")
@ApiTags("action-item-citation")
export class ActionItemCitationController extends BaseControllerFactory<ActionItemCitation>(
    ActionItemCitation,
    ActionItemCitationConditionDto,
    CreateActionItemCitationDto,
    UpdateActionItemCitationDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly actionItemCitationService: ActionItemCitationService) {
        super(actionItemCitationService);
    }
}
