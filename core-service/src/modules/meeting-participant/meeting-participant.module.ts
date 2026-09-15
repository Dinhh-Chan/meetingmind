import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MeetingParticipantController } from "./controllers/meeting-participant.controller";
import { MeetingParticipantSqlRepository } from "./repositories/meeting-participant-sql.repository";
import { MeetingParticipantService } from "./services/meeting-participant.service";

@Module({
    controllers: [MeetingParticipantController],
    providers: [
        MeetingParticipantService,
        RepositoryProvider(Entity.MEETING_PARTICIPANT, MeetingParticipantSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MeetingParticipantService],
})
export class MeetingParticipantModule {}
