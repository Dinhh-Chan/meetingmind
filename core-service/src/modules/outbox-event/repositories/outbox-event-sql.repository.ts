import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { OutboxEvent } from "../entities/outbox-event.entity";
import { OutboxEventModel } from "../models/outbox-event.model";
import { OutboxEventRepository } from "./outbox-event-repository.interface";

@Injectable()
export class OutboxEventSqlRepository
    extends SqlRepository<OutboxEvent>
    implements OutboxEventRepository
{
    constructor(
        @InjectModel(OutboxEventModel)
        private readonly outboxEventModel: ModelCtor<OutboxEventModel>,
    ) {
        super(outboxEventModel);
    }
}
