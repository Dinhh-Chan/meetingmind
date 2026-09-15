import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ProcessingJobController } from "./controllers/processing-job.controller";
import { ProcessingJobSqlRepository } from "./repositories/processing-job-sql.repository";
import { ProcessingJobService } from "./services/processing-job.service";

@Module({
    controllers: [ProcessingJobController],
    providers: [
        ProcessingJobService,
        RepositoryProvider(Entity.PROCESSING_JOB, ProcessingJobSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ProcessingJobService],
})
export class ProcessingJobModule {}
