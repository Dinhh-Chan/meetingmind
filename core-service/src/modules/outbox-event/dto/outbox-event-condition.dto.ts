import { PartialType } from "@nestjs/swagger";
import { OutboxEvent } from "../entities/outbox-event.entity";

export class OutboxEventConditionDto extends PartialType(OutboxEvent) {}
