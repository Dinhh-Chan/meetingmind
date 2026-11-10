import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ActivityLog } from "../entities/activity-log.entity";
import { ActivityLogModel } from "../models/activity-log.model";
import { ActivityLogRepository } from "./activity-log-repository.interface";

@Injectable()
export class ActivityLogSqlRepository extends SqlRepository<ActivityLog> implements ActivityLogRepository {
    constructor(
        @InjectModel(ActivityLogModel)
        private readonly activityLogModel: ModelCtor<ActivityLogModel>,
    ) {
        super(activityLogModel);
    }
}
