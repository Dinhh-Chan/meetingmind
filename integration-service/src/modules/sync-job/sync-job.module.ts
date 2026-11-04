import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { SyncJobSqlRepository } from "./repositories/sync-job-sql.repository";
import { SyncJobService } from "./services/sync-job.service";

@Module({
    providers: [
        SyncJobService,
        RepositoryProvider(Entity.SYNC_JOB, SyncJobSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [SyncJobService],
})
export class SyncJobModule {}
