import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { Meeting } from "../entities/meeting.entity";
import { MeetingRepository } from "../repositories/meeting-repository.interface";

@Injectable()
export class MeetingService extends BaseService<Meeting, MeetingRepository> {
    constructor(
        @InjectRepository(Entity.MEETING)
        private readonly meetingRepository: MeetingRepository,
    ) {
        super(meetingRepository);
    }
}
