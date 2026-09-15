import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ActionItemComment } from "../entities/action-item-comment.entity";
import { ActionItemCommentRepository } from "../repositories/action-item-comment-repository.interface";

@Injectable()
export class ActionItemCommentService extends BaseService<ActionItemComment, ActionItemCommentRepository> {
    constructor(
        @InjectRepository(Entity.ACTION_ITEM_COMMENT)
        private readonly actionItemCommentRepository: ActionItemCommentRepository,
    ) {
        super(actionItemCommentRepository);
    }
}
