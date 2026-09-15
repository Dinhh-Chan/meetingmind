import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ActionItemCommentController } from "./controllers/action-item-comment.controller";
import { ActionItemCommentSqlRepository } from "./repositories/action-item-comment-sql.repository";
import { ActionItemCommentService } from "./services/action-item-comment.service";

@Module({
    controllers: [ActionItemCommentController],
    providers: [
        ActionItemCommentService,
        RepositoryProvider(Entity.ACTION_ITEM_COMMENT, ActionItemCommentSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ActionItemCommentService],
})
export class ActionItemCommentModule {}
