import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MeetingMinutesController } from "./controllers/meeting-minutes.controller";
import { MeetingMinutesSqlRepository } from "./repositories/meeting-minutes-sql.repository";
import { MeetingMinutesService } from "./services/meeting-minutes.service";

@Module({
    controllers: [MeetingMinutesController],
    providers: [
        MeetingMinutesService,
        RepositoryProvider(Entity.MEETING_MINUTES, MeetingMinutesSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MeetingMinutesService],
})
export class MeetingMinutesModule {}
