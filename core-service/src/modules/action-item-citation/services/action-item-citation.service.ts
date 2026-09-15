import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ActionItemCitation } from "../entities/action-item-citation.entity";
import { ActionItemCitationRepository } from "../repositories/action-item-citation-repository.interface";

@Injectable()
export class ActionItemCitationService extends BaseService<ActionItemCitation, ActionItemCitationRepository> {
    constructor(
        @InjectRepository(Entity.ACTION_ITEM_CITATION)
        private readonly actionItemCitationRepository: ActionItemCitationRepository,
    ) {
        super(actionItemCitationRepository);
    }
}
