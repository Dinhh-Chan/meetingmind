import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ActionItemHistory } from "../entities/action-item-history.entity";
import { ActionItemHistoryModel } from "../models/action-item-history.model";
import { ActionItemHistoryRepository } from "./action-item-history-repository.interface";

@Injectable()
export class ActionItemHistorySqlRepository
    extends SqlRepository<ActionItemHistory>
    implements ActionItemHistoryRepository
{
    constructor(
        @InjectModel(ActionItemHistoryModel)
        private readonly actionItemHistoryModel: ModelCtor<ActionItemHistoryModel>,
    ) {
        super(actionItemHistoryModel);
    }
}
