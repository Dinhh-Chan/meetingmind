import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { MediaFile } from "../entities/media-file.entity";
import { MediaFileRepository } from "../repositories/media-file-repository.interface";

@Injectable()
export class MediaFileService extends BaseService<MediaFile, MediaFileRepository> {
    constructor(
        @InjectRepository(Entity.MEDIA_FILE)
        private readonly mediaFileRepository: MediaFileRepository,
    ) {
        super(mediaFileRepository);
    }
}
