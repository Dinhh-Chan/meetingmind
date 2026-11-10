import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ClarificationRequest } from "../entities/clarification-request.entity";
import { ClarificationRequestModel } from "../models/clarification-request.model";
import { ClarificationRequestRepository } from "./clarification-request-repository.interface";

@Injectable()
export class ClarificationRequestSqlRepository
    extends SqlRepository<ClarificationRequest>
    implements ClarificationRequestRepository
{
    constructor(
        @InjectModel(ClarificationRequestModel)
        private readonly clarificationRequestModel: ModelCtor<ClarificationRequestModel>,
    ) {
        super(clarificationRequestModel);
    }
}
