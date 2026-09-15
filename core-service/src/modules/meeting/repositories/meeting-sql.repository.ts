import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { Meeting } from "../entities/meeting.entity";
import { MeetingModel } from "../models/meeting.model";
import { MeetingRepository } from "./meeting-repository.interface";

@Injectable()
export class MeetingSqlRepository
    extends SqlRepository<Meeting>
    implements MeetingRepository
{
    constructor(
        @InjectModel(MeetingModel)
        private readonly meetingModel: ModelCtor<MeetingModel>,
    ) {
        super(meetingModel);
    }
}
