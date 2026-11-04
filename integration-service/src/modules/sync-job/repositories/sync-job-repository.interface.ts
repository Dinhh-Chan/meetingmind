import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { SyncJob } from "../entities/sync-job.entity";

export type SyncJobRepository = BaseRepository<SyncJob>;
