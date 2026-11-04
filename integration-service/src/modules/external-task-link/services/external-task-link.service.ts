import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ExternalTaskLink } from "../entities/external-task-link.entity";
import { ExternalTaskLinkRepository } from "../repositories/external-task-link-repository.interface";

@Injectable()
export class ExternalTaskLinkService extends BaseService<
    ExternalTaskLink,
    ExternalTaskLinkRepository
> {
    constructor(
        @InjectRepository(Entity.EXTERNAL_TASK_LINK)
        private readonly externalTaskLinkRepository: ExternalTaskLinkRepository,
    ) {
        super(externalTaskLinkRepository);
    }
}
