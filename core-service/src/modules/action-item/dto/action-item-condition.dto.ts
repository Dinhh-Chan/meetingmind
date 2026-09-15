import { PartialType } from "@nestjs/swagger";
import { ActionItem } from "../entities/action-item.entity";

export class ActionItemConditionDto extends PartialType(ActionItem) {}
