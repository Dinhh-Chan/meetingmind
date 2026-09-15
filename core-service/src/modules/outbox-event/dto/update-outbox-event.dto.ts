import { PartialType } from "@nestjs/swagger";
import { CreateOutboxEventDto } from "./create-outbox-event.dto";

export class UpdateOutboxEventDto extends PartialType(CreateOutboxEventDto) {}
