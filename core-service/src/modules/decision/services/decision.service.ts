import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { Decision } from "../entities/decision.entity";
import { DecisionRepository } from "../repositories/decision-repository.interface";

@Injectable()
export class DecisionService extends BaseService<Decision, DecisionRepository> {
    constructor(
        @InjectRepository(Entity.DECISION)
        private readonly decisionRepository: DecisionRepository,
    ) {
        super(decisionRepository);
    }
}
