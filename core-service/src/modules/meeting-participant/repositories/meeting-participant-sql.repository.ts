import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { MeetingParticipant } from "../entities/meeting-participant.entity";
import { MeetingParticipantModel } from "../models/meeting-participant.model";
import { MeetingParticipantRepository } from "./meeting-participant-repository.interface";

@Injectable()
export class MeetingParticipantSqlRepository
    extends SqlRepository<MeetingParticipant>
    implements MeetingParticipantRepository
{
    constructor(
        @InjectModel(MeetingParticipantModel)
        private readonly meetingParticipantModel: ModelCtor<MeetingParticipantModel>,
    ) {
        super(meetingParticipantModel);
    }
}
