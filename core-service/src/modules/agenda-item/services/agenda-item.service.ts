import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { AgendaItem } from "../entities/agenda-item.entity";
import { AgendaItemRepository } from "../repositories/agenda-item-repository.interface";

@Injectable()
export class AgendaItemService extends BaseService<AgendaItem, AgendaItemRepository> {
    constructor(
        @InjectRepository(Entity.AGENDA_ITEM)
        private readonly agendaItemRepository: AgendaItemRepository,
    ) {
        super(agendaItemRepository);
    }
}
