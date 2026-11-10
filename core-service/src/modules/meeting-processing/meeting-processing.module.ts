import { MeetingParticipantModule } from "@module/meeting-participant/meeting-participant.module";
import { MeetingRecordModule } from "@module/meeting-record/meeting-record.module";
import { MinutesTemplateModule } from "@module/minutes-template/minutes-template.module";
import { ProjectModule } from "@module/project/project.module";
import { UserModule } from "@module/user/user.module";
import { VoiceProfileModule } from "@module/voice-profile/voice-profile.module";
import { KnowledgeModule } from "@module/knowledge/knowledge.module";
import { MeetingMinutesModule } from "@module/meeting-minutes/meeting-minutes.module";
import { MeetingModule } from "@module/meeting/meeting.module";
import { MessagingModule } from "@module/messaging/messaging.module";
import { MinutesVersionModule } from "@module/minutes-version/minutes-version.module";
import { ProcessingJobModule } from "@module/processing-job/processing-job.module";
import { ReviewBatchModule } from "@module/review-batch/review-batch.module";
import { ReviewItemModule } from "@module/review-item/review-item.module";
import { SpeakerAliasModule } from "@module/speaker-alias/speaker-alias.module";
import { TranscriptSegmentModule } from "@module/transcript-segment/transcript-segment.module";
import { TranscriptVersionModule } from "@module/transcript-version/transcript-version.module";
import { Module } from "@nestjs/common";
import { MeetingProcessingConsumer } from "./consumers/meeting-processing.consumer";
import { MeetingProcessingController } from "./controllers/meeting-processing.controller";
import { LiveTranscriptService } from "./services/live-transcript.service";
import { MeetingProcessingService } from "./services/meeting-processing.service";

@Module({
    imports: [
        MeetingModule,
        MeetingMinutesModule,
        MinutesVersionModule,
        ProcessingJobModule,
        ReviewBatchModule,
        ReviewItemModule,
        SpeakerAliasModule,
        TranscriptSegmentModule,
        TranscriptVersionModule,
        MessagingModule,
        KnowledgeModule,
        MeetingParticipantModule,
        MeetingRecordModule,
        MinutesTemplateModule,
        ProjectModule,
        VoiceProfileModule,
        UserModule,
    ],
    controllers: [MeetingProcessingController],
    providers: [
        MeetingProcessingService,
        LiveTranscriptService,
        MeetingProcessingConsumer,
    ],
    exports: [MeetingProcessingService, LiveTranscriptService],
})
export class MeetingProcessingModule {}
