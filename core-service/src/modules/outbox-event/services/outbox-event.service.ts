import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { OutboxEvent } from "../entities/outbox-event.entity";
import { OutboxEventRepository } from "../repositories/outbox-event-repository.interface";

@Injectable()
export class OutboxEventService extends BaseService<OutboxEvent, OutboxEventRepository> {
    constructor(
        @InjectRepository(Entity.OUTBOX_EVENT)
        private readonly outboxEventRepository: OutboxEventRepository,
    ) {
        super(outboxEventRepository);
    }
}
