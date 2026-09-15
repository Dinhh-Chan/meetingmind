import { PartialType } from "@nestjs/swagger";
import { ProcessedMessage } from "../entities/processed-message.entity";

export class ProcessedMessageConditionDto extends PartialType(ProcessedMessage) {}
