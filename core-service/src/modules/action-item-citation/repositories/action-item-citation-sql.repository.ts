import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ActionItemCitation } from "../entities/action-item-citation.entity";
import { ActionItemCitationModel } from "../models/action-item-citation.model";
import { ActionItemCitationRepository } from "./action-item-citation-repository.interface";

@Injectable()
export class ActionItemCitationSqlRepository
    extends SqlRepository<ActionItemCitation>
    implements ActionItemCitationRepository
{
    constructor(
        @InjectModel(ActionItemCitationModel)
        private readonly actionItemCitationModel: ModelCtor<ActionItemCitationModel>,
    ) {
        super(actionItemCitationModel);
    }
}
