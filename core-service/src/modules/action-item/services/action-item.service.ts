import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ActionItem } from "../entities/action-item.entity";
import { ActionItemRepository } from "../repositories/action-item-repository.interface";

@Injectable()
export class ActionItemService extends BaseService<ActionItem, ActionItemRepository> {
    constructor(
        @InjectRepository(Entity.ACTION_ITEM)
        private readonly actionItemRepository: ActionItemRepository,
    ) {
        super(actionItemRepository);
    }
}
