import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateProcessedMessageDto } from "../dto/create-processed-message.dto";
import { ProcessedMessageConditionDto } from "../dto/processed-message-condition.dto";
import { UpdateProcessedMessageDto } from "../dto/update-processed-message.dto";
import { ProcessedMessage } from "../entities/processed-message.entity";
import { ProcessedMessageService } from "../services/processed-message.service";

@Controller("processed-message")
@ApiTags("processed-message")
export class ProcessedMessageController extends BaseControllerFactory<ProcessedMessage>(
    ProcessedMessage,
    ProcessedMessageConditionDto,
    CreateProcessedMessageDto,
    UpdateProcessedMessageDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly processedMessageService: ProcessedMessageService) {
        super(processedMessageService);
    }
}
