import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ProcessingJob } from "../entities/processing-job.entity";
import { ProcessingJobModel } from "../models/processing-job.model";
import { ProcessingJobRepository } from "./processing-job-repository.interface";

@Injectable()
export class ProcessingJobSqlRepository
    extends SqlRepository<ProcessingJob>
    implements ProcessingJobRepository
{
    constructor(
        @InjectModel(ProcessingJobModel)
        private readonly processingJobModel: ModelCtor<ProcessingJobModel>,
    ) {
        super(processingJobModel);
    }
}
