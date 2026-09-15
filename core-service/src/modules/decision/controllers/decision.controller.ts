import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateDecisionDto } from "../dto/create-decision.dto";
import { DecisionConditionDto } from "../dto/decision-condition.dto";
import { UpdateDecisionDto } from "../dto/update-decision.dto";
import { Decision } from "../entities/decision.entity";
import { DecisionService } from "../services/decision.service";

@Controller("decision")
@ApiTags("decision")
export class DecisionController extends BaseControllerFactory<Decision>(
    Decision,
    DecisionConditionDto,
    CreateDecisionDto,
    UpdateDecisionDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.MINUTES_VIEW_APPROVED },
            getPage: { permission: Permission.MINUTES_VIEW_APPROVED },
            getOne: { permission: Permission.MINUTES_VIEW_APPROVED },
            getById: { permission: Permission.MINUTES_VIEW_APPROVED },
            exportDefinition: { permission: Permission.MINUTES_VIEW_APPROVED },
            exportXlsx: { permission: Permission.MINUTES_VIEW_APPROVED },
            create: { permission: Permission.REVIEW_UPDATE },
            upsert: { permission: Permission.REVIEW_UPDATE },
            getOneOrUpsert: { permission: Permission.REVIEW_UPDATE },
            updateById: { permission: Permission.REVIEW_UPDATE },
            updateByIds: { permission: Permission.REVIEW_UPDATE },
            deleteById: { permission: Permission.REVIEW_APPROVE },
            deleteByIds: { permission: Permission.REVIEW_APPROVE },
        },
    },
) {
    constructor(private readonly decisionService: DecisionService) {
        super(decisionService);
    }
}
