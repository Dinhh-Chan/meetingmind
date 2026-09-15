import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ProcessingJob } from "../entities/processing-job.entity";
import { ProcessingJobRepository } from "../repositories/processing-job-repository.interface";

@Injectable()
export class ProcessingJobService extends BaseService<ProcessingJob, ProcessingJobRepository> {
    constructor(
        @InjectRepository(Entity.PROCESSING_JOB)
        private readonly processingJobRepository: ProcessingJobRepository,
    ) {
        super(processingJobRepository);
    }
}
