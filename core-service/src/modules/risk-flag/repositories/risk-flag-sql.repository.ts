import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { RiskFlag } from "../entities/risk-flag.entity";
import { RiskFlagModel } from "../models/risk-flag.model";
import { RiskFlagRepository } from "./risk-flag-repository.interface";

@Injectable()
export class RiskFlagSqlRepository
    extends SqlRepository<RiskFlag>
    implements RiskFlagRepository
{
    constructor(
        @InjectModel(RiskFlagModel)
        private readonly riskFlagModel: ModelCtor<RiskFlagModel>,
    ) {
        super(riskFlagModel);
    }
}
