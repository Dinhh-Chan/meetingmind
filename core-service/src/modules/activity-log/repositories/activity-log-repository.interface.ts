import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { ActivityLog } from "../entities/activity-log.entity";

export type ActivityLogRepository = BaseRepository<ActivityLog>;
