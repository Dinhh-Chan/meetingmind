import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly decisionCitationService: DecisionCitationService) {
        super(decisionCitationService);
    }
}
