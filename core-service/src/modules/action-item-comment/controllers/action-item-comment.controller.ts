import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.TASK_VIEW },
            getPage: { permission: Permission.TASK_VIEW },
            getOne: { permission: Permission.TASK_VIEW },
            getById: { permission: Permission.TASK_VIEW },
            exportDefinition: { permission: Permission.TASK_VIEW },
            exportXlsx: { permission: Permission.TASK_VIEW },
            create: { permission: Permission.TASK_COMMENT_CREATE },
            upsert: { permission: Permission.TASK_COMMENT_CREATE },
            getOneOrUpsert: { permission: Permission.TASK_COMMENT_CREATE },
            updateById: { permission: Permission.TASK_COMMENT_CREATE },
            updateByIds: { permission: Permission.TASK_COMMENT_CREATE },
            deleteById: { permission: Permission.TASK_COMMENT_MODERATE },
            deleteByIds: { permission: Permission.TASK_COMMENT_MODERATE },
        },
    },
) {
    constructor(private readonly actionItemCommentService: ActionItemCommentService) {
        super(actionItemCommentService);
    }
}
