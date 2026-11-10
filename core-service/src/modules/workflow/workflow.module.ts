import { ActionItemCommentModule } from "@module/action-item-comment/action-item-comment.module";
import { ActionItemModule } from "@module/action-item/action-item.module";
import { AgendaItemModule } from "@module/agenda-item/agenda-item.module";
import { MeetingBotModule } from "@module/meeting-bot/meeting-bot.module";
import { MeetingAccessModule } from "@module/meeting-access/meeting-access.module";
import { DecisionModule } from "@module/decision/decision.module";
import { KnowledgeModule } from "@module/knowledge/knowledge.module";
import { MediaFileModule } from "@module/media-file/media-file.module";
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
import { InvitationModule } from "@module/invitation/invitation.module";
import { Module } from "@nestjs/common";
import { MeetingProcessingModule } from "@module/meeting-processing/meeting-processing.module";
import { TaskSyncConsumer } from "./consumers/task-sync.consumer";
import { KnowledgeController } from "./controllers/knowledge.controller";
import { WorkflowController } from "./controllers/workflow.controller";
import { KnowledgeService } from "./services/knowledge.service";
import { WorkflowService } from "./services/workflow.service";

@Module({
    imports: [
        InvitationModule,
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
        KnowledgeModule,
        MediaFileModule,
    ],
    controllers: [WorkflowController, KnowledgeController],
    providers: [WorkflowService, KnowledgeService, TaskSyncConsumer],
})
export class WorkflowModule {}
