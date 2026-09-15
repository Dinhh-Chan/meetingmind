import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MeetingAccessController } from "./controllers/meeting-access.controller";
import { MeetingAccessSqlRepository } from "./repositories/meeting-access-sql.repository";
import { MeetingAccessService } from "./services/meeting-access.service";

@Module({
    controllers: [MeetingAccessController],
    providers: [
        MeetingAccessService,
        RepositoryProvider(Entity.MEETING_ACCESS, MeetingAccessSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MeetingAccessService],
})
export class MeetingAccessModule {}
