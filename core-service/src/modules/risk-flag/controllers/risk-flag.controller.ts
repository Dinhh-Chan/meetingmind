import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateRiskFlagDto } from "../dto/create-risk-flag.dto";
import { RiskFlagConditionDto } from "../dto/risk-flag-condition.dto";
import { UpdateRiskFlagDto } from "../dto/update-risk-flag.dto";
import { RiskFlag } from "../entities/risk-flag.entity";
import { RiskFlagService } from "../services/risk-flag.service";

@Controller("risk-flag")
@ApiTags("risk-flag")
export class RiskFlagController extends BaseControllerFactory<RiskFlag>(
    RiskFlag,
    RiskFlagConditionDto,
    CreateRiskFlagDto,
    UpdateRiskFlagDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly riskFlagService: RiskFlagService) {
        super(riskFlagService);
    }
}
