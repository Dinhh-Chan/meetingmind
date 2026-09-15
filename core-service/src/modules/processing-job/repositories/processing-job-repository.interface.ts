import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { ProcessingJob } from "../entities/processing-job.entity";

export type ProcessingJobRepository = BaseRepository<ProcessingJob>;
