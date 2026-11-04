import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ExternalTaskLink } from "../entities/external-task-link.entity";
import { ExternalTaskLinkModel } from "../models/external-task-link.model";
import { ExternalTaskLinkRepository } from "./external-task-link-repository.interface";

@Injectable()
export class ExternalTaskLinkSqlRepository
    extends SqlRepository<ExternalTaskLink>
    implements ExternalTaskLinkRepository
{
    constructor(
        @InjectModel(ExternalTaskLinkModel)
        private readonly externalTaskLinkModel: ModelCtor<ExternalTaskLinkModel>,
    ) {
        super(externalTaskLinkModel);
    }
}
