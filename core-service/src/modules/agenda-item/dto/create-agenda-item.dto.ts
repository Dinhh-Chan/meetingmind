import { OmitType } from "@nestjs/swagger";
import { AgendaItem } from "../entities/agenda-item.entity";

export class CreateAgendaItemDto extends OmitType(AgendaItem, ["_id"] as const) {}
