import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { MeetingAccess } from "../entities/meeting-access.entity";
import { MeetingAccessModel } from "../models/meeting-access.model";
import { MeetingAccessRepository } from "./meeting-access-repository.interface";

@Injectable()
export class MeetingAccessSqlRepository
    extends SqlRepository<MeetingAccess>
    implements MeetingAccessRepository
{
    constructor(
        @InjectModel(MeetingAccessModel)
        private readonly meetingAccessModel: ModelCtor<MeetingAccessModel>,
    ) {
        super(meetingAccessModel);
    }
}
