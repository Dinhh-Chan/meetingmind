import { OmitType } from "@nestjs/swagger";
import { ActionItem } from "../entities/action-item.entity";

export class CreateActionItemDto extends OmitType(ActionItem, ["_id"] as const) {}
