import { ActionItemCommentModule } from "@module/action-item-comment/action-item-comment.module";
import { ActionItemModule } from "@module/action-item/action-item.module";
import { AgendaItemModule } from "@module/agenda-item/agenda-item.module";
import { MeetingBotModule } from "@module/meeting-bot/meeting-bot.module";
import { MeetingAccessModule } from "@module/meeting-access/meeting-access.module";
import { DecisionModule } from "@module/decision/decision.module";
import { MeetingMinutesModule } from "@module/meeting-minutes/meeting-minutes.module";
import { MeetingParticipantModule } from "@module/meeting-participant/meeting-participant.module";
import { MeetingModule } from "@module/meeting/meeting.module";
import { MinutesVersionModule } from "@module/minutes-version/minutes-version.module";
import { NoteModule } from "@module/note/note.module";
import { ReviewBatchModule } from "@module/review-batch/review-batch.module";
import { ReviewItemModule } from "@module/review-item/review-item.module";
import { SpeakerAliasModule } from "@module/speaker-alias/speaker-alias.module";
import { TranscriptSegmentModule } from "@module/transcript-segment/transcript-segment.module";
import { TranscriptVersionModule } from "@module/transcript-version/transcript-version.module";
import { UserModule } from "@module/user/user.module";
import { WorkspaceMemberModule } from "@module/workspace-member/workspace-member.module";
import { Module } from "@nestjs/common";
import { MeetingProcessingModule } from "@module/meeting-processing/meeting-processing.module";
import { WorkflowController } from "./controllers/workflow.controller";
import { WorkflowService } from "./services/workflow.service";

@Module({
    imports: [
        MeetingModule,
        MeetingMinutesModule,
        MinutesVersionModule,
        ReviewBatchModule,
        ReviewItemModule,
        ActionItemModule,
        ActionItemCommentModule,
        DecisionModule,
        NoteModule,
        AgendaItemModule,
        MeetingParticipantModule,
        TranscriptVersionModule,
        TranscriptSegmentModule,
        SpeakerAliasModule,
        WorkspaceMemberModule,
        UserModule,
        MeetingAccessModule,
        MeetingBotModule,
        MeetingProcessingModule,
    ],
    controllers: [WorkflowController],
    providers: [WorkflowService],
})
export class WorkflowModule {}
