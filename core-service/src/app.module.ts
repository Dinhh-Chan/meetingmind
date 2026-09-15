import { UserSessionModule } from "@module/user-session/user-session.module";
import { AgendaItemModule } from "@module/agenda-item/agenda-item.module";
import { RecordingConsentModule } from "@module/recording-consent/recording-consent.module";
import { UploadSessionModule } from "@module/upload-session/upload-session.module";
import { RecordingSegmentModule } from "@module/recording-segment/recording-segment.module";
import { BotSessionModule } from "@module/bot-session/bot-session.module";
import { TranscriptVersionModule } from "@module/transcript-version/transcript-version.module";
import { NoteModule } from "@module/note/note.module";
import { MinutesVersionModule } from "@module/minutes-version/minutes-version.module";
import { DecisionModule } from "@module/decision/decision.module";
import { DecisionCitationModule } from "@module/decision-citation/decision-citation.module";
import { TaskDependencyModule } from "@module/task-dependency/task-dependency.module";
import { ProcessingJobModule } from "@module/processing-job/processing-job.module";
import { OutboxEventModule } from "@module/outbox-event/outbox-event.module";
import { ProcessedMessageModule } from "@module/processed-message/processed-message.module";
import { OauthAccountModule } from "@module/oauth-account/oauth-account.module";
import { WorkspaceModule } from "@module/workspace/workspace.module";
import { WorkspaceMemberModule } from "@module/workspace-member/workspace-member.module";
import { WorkspaceSettingModule } from "@module/workspace-setting/workspace-setting.module";
import { ProjectModule } from "@module/project/project.module";
import { ProjectMemberModule } from "@module/project-member/project-member.module";
import { MeetingModule } from "@module/meeting/meeting.module";
import { MeetingParticipantModule } from "@module/meeting-participant/meeting-participant.module";
import { TranscriptSegmentModule } from "@module/transcript-segment/transcript-segment.module";
import { SpeakerAliasModule } from "@module/speaker-alias/speaker-alias.module";
import { MeetingMinutesModule } from "@module/meeting-minutes/meeting-minutes.module";
import { ActionItemModule } from "@module/action-item/action-item.module";
import { ActionItemCitationModule } from "@module/action-item-citation/action-item-citation.module";
import { ActionItemCommentModule } from "@module/action-item-comment/action-item-comment.module";
import { ActionItemHistoryModule } from "@module/action-item-history/action-item-history.module";
import { ReviewBatchModule } from "@module/review-batch/review-batch.module";
import { ReviewItemModule } from "@module/review-item/review-item.module";
import { RiskFlagModule } from "@module/risk-flag/risk-flag.module";
import { DefaultModules, DefaultProviders } from "@config/module/config";
import { AuditLogModule } from "@module/audit-log/audit-log.module";
import { IncrementModule } from "@module/increment/increment.module";
import { RedisModule } from "@module/redis/redis.module";
import { SsoModule } from "@module/sso/sso.module";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { CommonProviderModule } from "./modules/common-provider/common-provider.module";
import { DataPartitionModule } from "./modules/data-partition/data-partition.module";
import { DataProcessModule } from "./modules/data-process/data-process.module";
import { EventAccountModule } from "./modules/event-account/event-account.module";
import { FileModule } from "./modules/file/file.module";
import { ImportSessionModule } from "./modules/import-session/import-session.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { OneSignalModule } from "./modules/one-signal/one-signal.module";
import { QuyTacMaModule } from "./modules/quy-tac-ma/quy-tac-ma.module";
import { SettingModule } from "./modules/setting/setting.module";
import { TopicModule } from "./modules/topic/topic.module";
import { UserModule } from "./modules/user/user.module";
import { EventModule } from "./modules/event/event.module";
import { EventLogModule } from "./modules/event-log/event-log.module";
import { WebSocketModule } from "./modules/websocket/websocket.module";

@Module({
    imports: [
        ...DefaultModules,
        AuthModule,
        UserModule,
        EventAccountModule,
        OneSignalModule,
        NotificationModule,
        TopicModule,
        FileModule,
        SettingModule,
        RedisModule,
        SsoModule,
        IncrementModule,
        ImportSessionModule,
        QuyTacMaModule,
        AuditLogModule,
        DataProcessModule,
        DataPartitionModule,
        CommonProviderModule,
        EventModule,
        EventLogModule,
        WebSocketModule,
        OauthAccountModule,
        WorkspaceModule,
        WorkspaceMemberModule,
        WorkspaceSettingModule,
        ProjectModule,
        ProjectMemberModule,
        MeetingModule,
        MeetingParticipantModule,
        TranscriptSegmentModule,
        SpeakerAliasModule,
        MeetingMinutesModule,
        ActionItemModule,
        ActionItemCitationModule,
        ActionItemCommentModule,
        ActionItemHistoryModule,
        ReviewBatchModule,
        ReviewItemModule,
        RiskFlagModule,
        UserSessionModule,
        AgendaItemModule,
        RecordingConsentModule,
        UploadSessionModule,
        RecordingSegmentModule,
        BotSessionModule,
        TranscriptVersionModule,
        NoteModule,
        MinutesVersionModule,
        DecisionModule,
        DecisionCitationModule,
        TaskDependencyModule,
        ProcessingJobModule,
        OutboxEventModule,
        ProcessedMessageModule,
    ],
    providers: [...DefaultProviders],
    controllers: [AppController],
})
export class AppModule {}
