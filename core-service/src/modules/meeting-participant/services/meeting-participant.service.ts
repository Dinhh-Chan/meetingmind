import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { MeetingParticipant } from "../entities/meeting-participant.entity";
import { MeetingParticipantRepository } from "../repositories/meeting-participant-repository.interface";

@Injectable()
export class MeetingParticipantService extends BaseService<MeetingParticipant, MeetingParticipantRepository> {
    constructor(
        @InjectRepository(Entity.MEETING_PARTICIPANT)
        private readonly meetingParticipantRepository: MeetingParticipantRepository,
    ) {
        super(meetingParticipantRepository);
    }
}
