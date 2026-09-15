import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { MinutesVersion } from "../entities/minutes-version.entity";
import { MinutesVersionRepository } from "../repositories/minutes-version-repository.interface";

@Injectable()
export class MinutesVersionService extends BaseService<MinutesVersion, MinutesVersionRepository> {
    constructor(
        @InjectRepository(Entity.MINUTES_VERSION)
        private readonly minutesVersionRepository: MinutesVersionRepository,
    ) {
        super(minutesVersionRepository);
    }
}
