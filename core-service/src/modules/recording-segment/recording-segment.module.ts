import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { RecordingSegmentController } from "./controllers/recording-segment.controller";
import { RecordingSegmentSqlRepository } from "./repositories/recording-segment-sql.repository";
import { RecordingSegmentService } from "./services/recording-segment.service";

@Module({
    controllers: [RecordingSegmentController],
    providers: [
        RecordingSegmentService,
        RepositoryProvider(Entity.RECORDING_SEGMENT, RecordingSegmentSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [RecordingSegmentService],
})
export class RecordingSegmentModule {}
