import { PartialType } from "@nestjs/swagger";
import { ActionItemHistory } from "../entities/action-item-history.entity";

export class ActionItemHistoryConditionDto extends PartialType(ActionItemHistory) {}
