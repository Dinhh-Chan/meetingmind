import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateActionItemCommentDto } from "../dto/create-action-item-comment.dto";
import { ActionItemCommentConditionDto } from "../dto/action-item-comment-condition.dto";
import { UpdateActionItemCommentDto } from "../dto/update-action-item-comment.dto";
import { ActionItemComment } from "../entities/action-item-comment.entity";
import { ActionItemCommentService } from "../services/action-item-comment.service";

@Controller("action-item-comment")
@ApiTags("action-item-comment")
export class ActionItemCommentController extends BaseControllerFactory<ActionItemComment>(
    ActionItemComment,
    ActionItemCommentConditionDto,
    CreateActionItemCommentDto,
    UpdateActionItemCommentDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly actionItemCommentService: ActionItemCommentService) {
        super(actionItemCommentService);
    }
}
