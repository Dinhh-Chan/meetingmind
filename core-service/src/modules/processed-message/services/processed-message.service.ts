import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ProcessedMessage } from "../entities/processed-message.entity";
import { ProcessedMessageRepository } from "../repositories/processed-message-repository.interface";

@Injectable()
export class ProcessedMessageService extends BaseService<ProcessedMessage, ProcessedMessageRepository> {
    constructor(
        @InjectRepository(Entity.PROCESSED_MESSAGE)
        private readonly processedMessageRepository: ProcessedMessageRepository,
    ) {
        super(processedMessageRepository);
    }
}
