import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
    constructor(private readonly actionItemCitationService: ActionItemCitationService) {
        super(actionItemCitationService);
    }
}
