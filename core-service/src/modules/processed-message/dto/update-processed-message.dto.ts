import { PartialType } from "@nestjs/swagger";
import { CreateProcessedMessageDto } from "./create-processed-message.dto";

export class UpdateProcessedMessageDto extends PartialType(CreateProcessedMessageDto) {}
