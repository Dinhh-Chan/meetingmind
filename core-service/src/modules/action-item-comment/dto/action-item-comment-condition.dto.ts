import { PartialType } from "@nestjs/swagger";
import { ActionItemComment } from "../entities/action-item-comment.entity";

export class ActionItemCommentConditionDto extends PartialType(ActionItemComment) {}
