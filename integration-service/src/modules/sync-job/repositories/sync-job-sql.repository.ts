import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { SyncJob } from "../entities/sync-job.entity";
import { SyncJobModel } from "../models/sync-job.model";
import { SyncJobRepository } from "./sync-job-repository.interface";

@Injectable()
export class SyncJobSqlRepository
    extends SqlRepository<SyncJob>
    implements SyncJobRepository
{
    constructor(
        @InjectModel(SyncJobModel)
        private readonly syncJobModel: ModelCtor<SyncJobModel>,
    ) {
        super(syncJobModel);
    }
}
