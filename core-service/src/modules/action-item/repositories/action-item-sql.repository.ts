import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ActionItem } from "../entities/action-item.entity";
import { ActionItemModel } from "../models/action-item.model";
import { ActionItemRepository } from "./action-item-repository.interface";

@Injectable()
export class ActionItemSqlRepository
    extends SqlRepository<ActionItem>
    implements ActionItemRepository
{
    constructor(
        @InjectModel(ActionItemModel)
        private readonly actionItemModel: ModelCtor<ActionItemModel>,
    ) {
        super(actionItemModel);
    }
}
