import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { DecisionCitation } from "../entities/decision-citation.entity";
import { DecisionCitationRepository } from "../repositories/decision-citation-repository.interface";

@Injectable()
export class DecisionCitationService extends BaseService<DecisionCitation, DecisionCitationRepository> {
    constructor(
        @InjectRepository(Entity.DECISION_CITATION)
        private readonly decisionCitationRepository: DecisionCitationRepository,
    ) {
        super(decisionCitationRepository);
    }
}
