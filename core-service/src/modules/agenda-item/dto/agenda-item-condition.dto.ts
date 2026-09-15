import { PartialType } from "@nestjs/swagger";
import { AgendaItem } from "../entities/agenda-item.entity";

export class AgendaItemConditionDto extends PartialType(AgendaItem) {}
