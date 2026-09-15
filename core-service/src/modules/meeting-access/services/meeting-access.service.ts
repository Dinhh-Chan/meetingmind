import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { MeetingAccess } from "../entities/meeting-access.entity";
import { MeetingAccessRepository } from "../repositories/meeting-access-repository.interface";

@Injectable()
export class MeetingAccessService extends BaseService<MeetingAccess, MeetingAccessRepository> {
    constructor(
        @InjectRepository(Entity.MEETING_ACCESS)
        private readonly meetingAccessRepository: MeetingAccessRepository,
    ) {
        super(meetingAccessRepository);
    }
}
