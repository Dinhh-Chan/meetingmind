import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { UploadSession } from "../entities/upload-session.entity";
import { UploadSessionRepository } from "../repositories/upload-session-repository.interface";

@Injectable()
export class UploadSessionService extends BaseService<UploadSession, UploadSessionRepository> {
    constructor(
        @InjectRepository(Entity.UPLOAD_SESSION)
        private readonly uploadSessionRepository: UploadSessionRepository,
    ) {
        super(uploadSessionRepository);
    }
}
