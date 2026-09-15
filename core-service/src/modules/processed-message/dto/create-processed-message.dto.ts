import { OmitType } from "@nestjs/swagger";
import { ProcessedMessage } from "../entities/processed-message.entity";

export class CreateProcessedMessageDto extends OmitType(ProcessedMessage, ["_id"] as const) {}
