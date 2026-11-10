import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { VoiceProfile } from "../entities/voice-profile.entity";
import { VoiceProfileModel } from "../models/voice-profile.model";
import { VoiceProfileRepository } from "./voice-profile-repository.interface";

@Injectable()
export class VoiceProfileSqlRepository
    extends SqlRepository<VoiceProfile>
    implements VoiceProfileRepository
{
    constructor(
        @InjectModel(VoiceProfileModel)
        private readonly voiceProfileModel: ModelCtor<VoiceProfileModel>,
    ) {
        super(voiceProfileModel);
    }
}
