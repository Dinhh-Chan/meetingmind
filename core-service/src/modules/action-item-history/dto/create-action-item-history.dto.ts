import { OmitType } from "@nestjs/swagger";
import { ActionItemHistory } from "../entities/action-item-history.entity";

export class CreateActionItemHistoryDto extends OmitType(ActionItemHistory, ["_id"] as const) {}
