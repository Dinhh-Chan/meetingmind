import { OmitType } from "@nestjs/swagger";
import { ActionItemComment } from "../entities/action-item-comment.entity";

export class CreateActionItemCommentDto extends OmitType(ActionItemComment, ["_id"] as const) {}
