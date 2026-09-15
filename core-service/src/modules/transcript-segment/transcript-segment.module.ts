import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { TranscriptSegmentController } from "./controllers/transcript-segment.controller";
import { TranscriptSegmentSqlRepository } from "./repositories/transcript-segment-sql.repository";
import { TranscriptSegmentService } from "./services/transcript-segment.service";

@Module({
    controllers: [TranscriptSegmentController],
    providers: [
        TranscriptSegmentService,
        RepositoryProvider(Entity.TRANSCRIPT_SEGMENT, TranscriptSegmentSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [TranscriptSegmentService],
})
export class TranscriptSegmentModule {}
