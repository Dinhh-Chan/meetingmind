import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { RecordingConsent } from "../entities/recording-consent.entity";
import { RecordingConsentModel } from "../models/recording-consent.model";
import { RecordingConsentRepository } from "./recording-consent-repository.interface";

@Injectable()
export class RecordingConsentSqlRepository
    extends SqlRepository<RecordingConsent>
    implements RecordingConsentRepository
{
    constructor(
        @InjectModel(RecordingConsentModel)
        private readonly recordingConsentModel: ModelCtor<RecordingConsentModel>,
    ) {
        super(recordingConsentModel);
    }
}
