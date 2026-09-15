import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { Decision } from "../entities/decision.entity";
import { DecisionModel } from "../models/decision.model";
import { DecisionRepository } from "./decision-repository.interface";

@Injectable()
export class DecisionSqlRepository
    extends SqlRepository<Decision>
    implements DecisionRepository
{
    constructor(
        @InjectModel(DecisionModel)
        private readonly decisionModel: ModelCtor<DecisionModel>,
    ) {
        super(decisionModel);
    }
}
