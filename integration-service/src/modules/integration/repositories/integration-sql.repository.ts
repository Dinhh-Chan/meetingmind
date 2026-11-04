import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { Integration } from "../entities/integration.entity";
import { IntegrationModel } from "../models/integration.model";
import { IntegrationRepository } from "./integration-repository.interface";

@Injectable()
export class IntegrationSqlRepository
    extends SqlRepository<Integration>
    implements IntegrationRepository
{
    constructor(
        @InjectModel(IntegrationModel)
        private readonly integrationModel: ModelCtor<IntegrationModel>,
    ) {
        super(integrationModel);
    }
}
