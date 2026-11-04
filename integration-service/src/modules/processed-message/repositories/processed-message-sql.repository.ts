import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ProcessedMessage } from "../entities/processed-message.entity";
import { ProcessedMessageModel } from "../models/processed-message.model";
import { ProcessedMessageRepository } from "./processed-message-repository.interface";

@Injectable()
export class ProcessedMessageSqlRepository
    extends SqlRepository<ProcessedMessage>
    implements ProcessedMessageRepository
{
    constructor(
        @InjectModel(ProcessedMessageModel)
        private readonly processedMessageModel: ModelCtor<ProcessedMessageModel>,
    ) {
        super(processedMessageModel);
    }
}
