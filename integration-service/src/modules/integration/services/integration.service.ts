import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { Integration } from "../entities/integration.entity";
import { IntegrationRepository } from "../repositories/integration-repository.interface";

@Injectable()
export class IntegrationService extends BaseService<
    Integration,
    IntegrationRepository
> {
    constructor(
        @InjectRepository(Entity.INTEGRATION)
        private readonly integrationRepository: IntegrationRepository,
    ) {
        super(integrationRepository);
    }
}
