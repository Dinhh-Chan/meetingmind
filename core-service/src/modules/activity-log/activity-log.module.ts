import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Global, Module } from "@nestjs/common";
import { ActivityLogSqlRepository } from "./repositories/activity-log-sql.repository";
import { ActivityLogService } from "./services/activity-log.service";

/** @Global: nhiều module nghiệp vụ cùng ghi nhật ký. */
@Global()
@Module({
    providers: [
        ActivityLogService,
        RepositoryProvider(Entity.ACTIVITY_LOG, ActivityLogSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ActivityLogService],
})
export class ActivityLogModule {}
