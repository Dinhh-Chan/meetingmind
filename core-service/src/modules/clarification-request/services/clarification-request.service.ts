import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ClarificationRequest } from "../entities/clarification-request.entity";
import { ClarificationRequestRepository } from "../repositories/clarification-request-repository.interface";

@Injectable()
export class ClarificationRequestService extends BaseService<
    ClarificationRequest,
    ClarificationRequestRepository
> {
    constructor(
        @InjectRepository(Entity.CLARIFICATION_REQUEST)
        private readonly clarificationRequestRepository: ClarificationRequestRepository,
    ) {
        super(clarificationRequestRepository);
    }
}
