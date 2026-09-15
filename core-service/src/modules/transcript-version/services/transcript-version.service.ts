import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { TranscriptVersion } from "../entities/transcript-version.entity";
import { TranscriptVersionRepository } from "../repositories/transcript-version-repository.interface";

@Injectable()
export class TranscriptVersionService extends BaseService<TranscriptVersion, TranscriptVersionRepository> {
    constructor(
        @InjectRepository(Entity.TRANSCRIPT_VERSION)
        private readonly transcriptVersionRepository: TranscriptVersionRepository,
    ) {
        super(transcriptVersionRepository);
    }
}
