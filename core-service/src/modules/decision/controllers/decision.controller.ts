import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly decisionService: DecisionService) {
        super(decisionService);
    }
}
