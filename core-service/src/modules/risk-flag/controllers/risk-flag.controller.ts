import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.RISK_VIEW_PROJECT },
            getPage: { permission: Permission.RISK_VIEW_PROJECT },
            getOne: { permission: Permission.RISK_VIEW_PROJECT },
            getById: { permission: Permission.RISK_VIEW_PROJECT },
            exportDefinition: { permission: Permission.RISK_VIEW_PROJECT },
            exportXlsx: { permission: Permission.RISK_VIEW_PROJECT },
            create: { permission: Permission.RISK_RESOLVE },
            upsert: { permission: Permission.RISK_RESOLVE },
            getOneOrUpsert: { permission: Permission.RISK_RESOLVE },
            updateById: { permission: Permission.RISK_RESOLVE },
            updateByIds: { permission: Permission.RISK_RESOLVE },
            deleteById: { permission: Permission.RISK_RESOLVE },
            deleteByIds: { permission: Permission.RISK_RESOLVE },
        },
    },
) {
    constructor(private readonly riskFlagService: RiskFlagService) {
        super(riskFlagService);
    }
}
