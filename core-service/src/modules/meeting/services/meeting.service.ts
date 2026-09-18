import { BaseService } from "@config/service/base.service";
import { MeetingAccessRole } from "@module/meeting-access/common/constant";
import { MeetingAccessService } from "@module/meeting-access/services/meeting-access.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { User } from "@module/user/entities/user.entity";
import { Injectable } from "@nestjs/common";
import { MeetingAccessScope } from "../common/constant";
import { Meeting } from "../entities/meeting.entity";
import { MeetingRepository } from "../repositories/meeting-repository.interface";

@Injectable()
export class MeetingService extends BaseService<Meeting, MeetingRepository> {
    constructor(
        @InjectRepository(Entity.MEETING)
        private readonly meetingRepository: MeetingRepository,
        private readonly meetingAccessService: MeetingAccessService,
    ) {
        super(meetingRepository);
    }

    /**
     * Tạo cuộc họp. Với cuộc họp không thuộc project (`accessScope =
     * restricted`), người tạo được gán MANAGER — nếu không thì chính họ cũng
     * không truy cập được cuộc họp vừa tạo. Ma trận phân quyền mục 4.
     */
    async create(user: User, dto: Partial<Meeting>) {
        const createdById = dto.createdById || user?._id;
        const meeting = await super.create(user, { ...dto, createdById });

        const standalone =
            meeting.accessScope === MeetingAccessScope.RESTRICTED ||
            !meeting.projectId;
        if (standalone && createdById) {
            await this.meetingAccessService.create(user, {
                workspaceId: meeting.workspaceId,
                meetingId: meeting._id,
                userId: createdById,
                role: MeetingAccessRole.MANAGER,
                grantedById: createdById,
            });
        }

        return meeting;
    }
}
