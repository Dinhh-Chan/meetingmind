import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { MinutesTemplate } from "../entities/minutes-template.entity";
import { MinutesTemplateModel } from "../models/minutes-template.model";
import { MinutesTemplateRepository } from "./minutes-template-repository.interface";

@Injectable()
export class MinutesTemplateSqlRepository
    extends SqlRepository<MinutesTemplate>
    implements MinutesTemplateRepository
{
    constructor(
        @InjectModel(MinutesTemplateModel)
        private readonly minutesTemplateModel: ModelCtor<MinutesTemplateModel>,
    ) {
        super(minutesTemplateModel);
    }
}
