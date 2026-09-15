import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ActionItemHistory } from "../entities/action-item-history.entity";
import { ActionItemHistoryRepository } from "../repositories/action-item-history-repository.interface";

@Injectable()
export class ActionItemHistoryService extends BaseService<ActionItemHistory, ActionItemHistoryRepository> {
    constructor(
        @InjectRepository(Entity.ACTION_ITEM_HISTORY)
        private readonly actionItemHistoryRepository: ActionItemHistoryRepository,
    ) {
        super(actionItemHistoryRepository);
    }
}
