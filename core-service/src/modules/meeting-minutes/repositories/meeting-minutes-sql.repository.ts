import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";
import { MeetingMinutesModel } from "../models/meeting-minutes.model";
import { MeetingMinutesRepository } from "./meeting-minutes-repository.interface";

@Injectable()
export class MeetingMinutesSqlRepository
    extends SqlRepository<MeetingMinutes>
    implements MeetingMinutesRepository
{
    constructor(
        @InjectModel(MeetingMinutesModel)
        private readonly meetingMinutesModel: ModelCtor<MeetingMinutesModel>,
    ) {
        super(meetingMinutesModel);
    }
}
