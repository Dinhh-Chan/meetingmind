import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { RiskFlag } from "../entities/risk-flag.entity";
import { RiskFlagRepository } from "../repositories/risk-flag-repository.interface";

@Injectable()
export class RiskFlagService extends BaseService<RiskFlag, RiskFlagRepository> {
    constructor(
        @InjectRepository(Entity.RISK_FLAG)
        private readonly riskFlagRepository: RiskFlagRepository,
    ) {
        super(riskFlagRepository);
    }
}
