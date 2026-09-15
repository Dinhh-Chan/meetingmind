import { OmitType } from "@nestjs/swagger";
import { ActionItemCitation } from "../entities/action-item-citation.entity";

export class CreateActionItemCitationDto extends OmitType(ActionItemCitation, ["_id"] as const) {}
