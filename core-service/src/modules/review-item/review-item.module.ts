import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ReviewItemController } from "./controllers/review-item.controller";
import { ReviewItemSqlRepository } from "./repositories/review-item-sql.repository";
import { ReviewItemService } from "./services/review-item.service";

@Module({
    controllers: [ReviewItemController],
    providers: [
        ReviewItemService,
        RepositoryProvider(Entity.REVIEW_ITEM, ReviewItemSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ReviewItemService],
})
export class ReviewItemModule {}
