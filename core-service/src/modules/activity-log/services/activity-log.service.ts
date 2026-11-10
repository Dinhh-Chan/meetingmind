import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable, Logger } from "@nestjs/common";
import { ActivityType } from "../common/constant";
import { ActivityLog } from "../entities/activity-log.entity";
import { ActivityLogRepository } from "../repositories/activity-log-repository.interface";

@Injectable()
export class ActivityLogService extends BaseService<ActivityLog, ActivityLogRepository> {
    private readonly logger = new Logger(ActivityLogService.name);

    constructor(
        @InjectRepository(Entity.ACTIVITY_LOG)
        private readonly activityLogRepository: ActivityLogRepository,
    ) {
        super(activityLogRepository);
    }

    /**
     * Ghi một thay đổi. Là việc phụ của thao tác chính: lỗi chỉ ghi log, không
     * làm hỏng thao tác người dùng vừa làm.
     */
    async record(entry: {
        workspaceId: string;
        actorId?: string | null;
        type: ActivityType;
        target: string;
        meetingId?: string | null;
        projectId?: string | null;
    }) {
        try {
            await this.create(null, {
                workspaceId: entry.workspaceId,
                actorId: entry.actorId ?? undefined,
                type: entry.type,
                target: entry.target,
                meetingId: entry.meetingId ?? undefined,
                projectId: entry.projectId ?? undefined,
            });
        } catch (err) {
            this.logger.warn(`Không ghi được nhật ký ${entry.type}: ${err.message}`);
        }
    }
}
