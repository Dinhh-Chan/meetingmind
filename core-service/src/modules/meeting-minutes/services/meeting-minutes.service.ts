import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";
import { MeetingMinutesRepository } from "../repositories/meeting-minutes-repository.interface";

@Injectable()
export class MeetingMinutesService extends BaseService<MeetingMinutes, MeetingMinutesRepository> {
    constructor(
        @InjectRepository(Entity.MEETING_MINUTES)
        private readonly meetingMinutesRepository: MeetingMinutesRepository,
    ) {
        super(meetingMinutesRepository);
    }
}
