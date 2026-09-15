import { PartialType } from "@nestjs/swagger";
import { ActionItemCitation } from "../entities/action-item-citation.entity";

export class ActionItemCitationConditionDto extends PartialType(ActionItemCitation) {}
