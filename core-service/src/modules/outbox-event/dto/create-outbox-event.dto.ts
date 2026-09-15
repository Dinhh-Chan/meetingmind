import { OmitType } from "@nestjs/swagger";
import { OutboxEvent } from "../entities/outbox-event.entity";

export class CreateOutboxEventDto extends OmitType(OutboxEvent, ["_id"] as const) {}
