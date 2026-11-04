import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { SyncJob } from "../entities/sync-job.entity";
import { SyncJobRepository } from "../repositories/sync-job-repository.interface";

@Injectable()
export class SyncJobService extends BaseService<SyncJob, SyncJobRepository> {
    constructor(
        @InjectRepository(Entity.SYNC_JOB)
        private readonly syncJobRepository: SyncJobRepository,
    ) {
        super(syncJobRepository);
    }
}
