import { MeetingAccessModule } from "@module/meeting-access/meeting-access.module";
import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MeetingController } from "./controllers/meeting.controller";
import { MeetingSqlRepository } from "./repositories/meeting-sql.repository";
import { MeetingService } from "./services/meeting.service";

@Module({
    imports: [MeetingAccessModule],
    controllers: [MeetingController],
    providers: [
        MeetingService,
        RepositoryProvider(Entity.MEETING, MeetingSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MeetingService],
})
export class MeetingModule {}
