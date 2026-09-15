import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateDecisionCitationDto } from "../dto/create-decision-citation.dto";
import { DecisionCitationConditionDto } from "../dto/decision-citation-condition.dto";
import { UpdateDecisionCitationDto } from "../dto/update-decision-citation.dto";
import { DecisionCitation } from "../entities/decision-citation.entity";
import { DecisionCitationService } from "../services/decision-citation.service";

@Controller("decision-citation")
@ApiTags("decision-citation")
export class DecisionCitationController extends BaseControllerFactory<DecisionCitation>(
    DecisionCitation,
    DecisionCitationConditionDto,
    CreateDecisionCitationDto,
    UpdateDecisionCitationDto,
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
    constructor(private readonly decisionCitationService: DecisionCitationService) {
        super(decisionCitationService);
    }
}
