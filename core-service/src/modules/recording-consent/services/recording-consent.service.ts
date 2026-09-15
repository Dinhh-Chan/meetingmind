import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { RecordingConsent } from "../entities/recording-consent.entity";
import { RecordingConsentRepository } from "../repositories/recording-consent-repository.interface";

@Injectable()
export class RecordingConsentService extends BaseService<RecordingConsent, RecordingConsentRepository> {
    constructor(
        @InjectRepository(Entity.RECORDING_CONSENT)
        private readonly recordingConsentRepository: RecordingConsentRepository,
    ) {
        super(recordingConsentRepository);
    }
}
