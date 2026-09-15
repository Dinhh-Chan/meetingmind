import { PartialType } from "@nestjs/swagger";
import { CreateActionItemCommentDto } from "./create-action-item-comment.dto";

export class UpdateActionItemCommentDto extends PartialType(CreateActionItemCommentDto) {}
