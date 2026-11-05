import { DeleteManyQuery } from "@common/constant";
import { DeleteManyByIdsDto } from "@common/dto/delete-many-by-ids.dto";
import { BaseService } from "@config/service/base.service";
import { KnowledgeIndexService } from "@module/knowledge/services/knowledge-index.service";
import { MeetingAccessRole } from "@module/meeting-access/common/constant";
import { MeetingAccessService } from "@module/meeting-access/services/meeting-access.service";
import { Entity } from "@module/repository";
import { BaseQueryOption } from "@module/repository/common/base-repository.interface";
import { InjectRepository } from "@module/repository/common/repository";
import { User } from "@module/user/entities/user.entity";
import { Injectable, Logger } from "@nestjs/common";
import { MeetingAccessScope } from "../common/constant";
import { Meeting } from "../entities/meeting.entity";
import { MeetingRepository } from "../repositories/meeting-repository.interface";

@Injectable()
export class MeetingService extends BaseService<Meeting, MeetingRepository> {
    private readonly logger = new Logger(MeetingService.name);

    constructor(
        @InjectRepository(Entity.MEETING)
        private readonly meetingRepository: MeetingRepository,
        private readonly meetingAccessService: MeetingAccessService,
        private readonly knowledgeIndexService: KnowledgeIndexService,
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

    async deleteById(user: User, id: string, query?: BaseQueryOption<unknown>) {
        const meeting = await super.deleteById(user, id, query);
        if (meeting) await this.dropKnowledge([meeting]);
        return meeting;
    }

    async deleteManyByIds(
        user: User,
        dto: DeleteManyByIdsDto,
        query?: DeleteManyQuery<Meeting>,
    ) {
        const before = await this.getMany(null, { _id: { $in: dto.ids } });
        const res = await super.deleteManyByIds(user, dto, query);
        // Chỉ những cuộc họp thật sự đã xoá (lọc phân vùng có thể giữ lại vài cái).
        const left = new Set(
            (await this.getMany(null, { _id: { $in: dto.ids } })).map(
                (m) => m._id,
            ),
        );
        await this.dropKnowledge(before.filter((m) => !left.has(m._id)));
        return res;
    }

    /**
     * Cuộc họp đã xoá thì Core lọc khỏi hỏi đáp rồi, nhưng các đoạn đã lập chỉ
     * mục vẫn nằm ở kho AI: xin AI xoá luôn. Việc phụ — lỗi chỉ ghi log, không
     * làm hỏng thao tác xoá (cuộc họp đã xoá không bao giờ được đưa vào tìm).
     */
    private async dropKnowledge(
        meetings: Pick<Meeting, "_id" | "workspaceId">[],
    ) {
        for (const meeting of meetings) {
            try {
                await this.knowledgeIndexService.deleteSource(
                    meeting.workspaceId,
                    { meetingId: meeting._id },
                );
            } catch (err) {
                this.logger.warn(
                    `Không xin xoá chỉ mục của cuộc họp ${meeting._id}: ${err.message}`,
                );
            }
        }
    }
}
