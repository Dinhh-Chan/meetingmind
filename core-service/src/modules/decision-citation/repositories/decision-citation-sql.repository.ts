import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { DecisionCitation } from "../entities/decision-citation.entity";
import { DecisionCitationModel } from "../models/decision-citation.model";
import { DecisionCitationRepository } from "./decision-citation-repository.interface";

@Injectable()
export class DecisionCitationSqlRepository
    extends SqlRepository<DecisionCitation>
    implements DecisionCitationRepository
{
    constructor(
        @InjectModel(DecisionCitationModel)
        private readonly decisionCitationModel: ModelCtor<DecisionCitationModel>,
    ) {
        super(decisionCitationModel);
    }
}
