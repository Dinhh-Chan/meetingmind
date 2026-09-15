import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ActionItemComment } from "../entities/action-item-comment.entity";
import { ActionItemCommentModel } from "../models/action-item-comment.model";
import { ActionItemCommentRepository } from "./action-item-comment-repository.interface";

@Injectable()
export class ActionItemCommentSqlRepository
    extends SqlRepository<ActionItemComment>
    implements ActionItemCommentRepository
{
    constructor(
        @InjectModel(ActionItemCommentModel)
        private readonly actionItemCommentModel: ModelCtor<ActionItemCommentModel>,
    ) {
        super(actionItemCommentModel);
    }
}
