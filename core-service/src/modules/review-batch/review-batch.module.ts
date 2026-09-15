import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ReviewBatchController } from "./controllers/review-batch.controller";
import { ReviewBatchSqlRepository } from "./repositories/review-batch-sql.repository";
import { ReviewBatchService } from "./services/review-batch.service";

@Module({
    controllers: [ReviewBatchController],
    providers: [
        ReviewBatchService,
        RepositoryProvider(Entity.REVIEW_BATCH, ReviewBatchSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ReviewBatchService],
})
export class ReviewBatchModule {}
