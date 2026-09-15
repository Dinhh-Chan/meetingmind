import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { SpeakerAlias } from "../entities/speaker-alias.entity";
import { SpeakerAliasRepository } from "../repositories/speaker-alias-repository.interface";

@Injectable()
export class SpeakerAliasService extends BaseService<SpeakerAlias, SpeakerAliasRepository> {
    constructor(
        @InjectRepository(Entity.SPEAKER_ALIAS)
        private readonly speakerAliasRepository: SpeakerAliasRepository,
    ) {
        super(speakerAliasRepository);
    }
}
