import { MeetingMinutesModule } from "@module/meeting-minutes/meeting-minutes.module";
import { MeetingParticipantModule } from "@module/meeting-participant/meeting-participant.module";
import { MinutesVersionModule } from "@module/minutes-version/minutes-version.module";
import { TranscriptVersionModule } from "@module/transcript-version/transcript-version.module";
import { Module } from "@nestjs/common";
import { MeetingRecordService } from "./meeting-record.service";

@Module({
    imports: [
        TranscriptVersionModule,
        MeetingMinutesModule,
        MinutesVersionModule,
        MeetingParticipantModule,
    ],
    providers: [MeetingRecordService],
    exports: [MeetingRecordService],
})
export class MeetingRecordModule {}
