import { UserSessionModel } from "@module/user-session/models/user-session.model";
import { AgendaItemModel } from "@module/agenda-item/models/agenda-item.model";
import { RecordingConsentModel } from "@module/recording-consent/models/recording-consent.model";
import { UploadSessionModel } from "@module/upload-session/models/upload-session.model";
import { RecordingSegmentModel } from "@module/recording-segment/models/recording-segment.model";
import { BotSessionModel } from "@module/bot-session/models/bot-session.model";
import { TranscriptVersionModel } from "@module/transcript-version/models/transcript-version.model";
import { NoteModel } from "@module/note/models/note.model";
import { MinutesVersionModel } from "@module/minutes-version/models/minutes-version.model";
import { DecisionModel } from "@module/decision/models/decision.model";
import { DecisionCitationModel } from "@module/decision-citation/models/decision-citation.model";
import { TaskDependencyModel } from "@module/task-dependency/models/task-dependency.model";
import { ProcessingJobModel } from "@module/processing-job/models/processing-job.model";
import { OutboxEventModel } from "@module/outbox-event/models/outbox-event.model";
import { ProcessedMessageModel } from "@module/processed-message/models/processed-message.model";
import { OauthAccountModel } from "@module/oauth-account/models/oauth-account.model";
import { WorkspaceModel } from "@module/workspace/models/workspace.model";
import { WorkspaceMemberModel } from "@module/workspace-member/models/workspace-member.model";
import { WorkspaceSettingModel } from "@module/workspace-setting/models/workspace-setting.model";
import { ProjectModel } from "@module/project/models/project.model";
import { ProjectMemberModel } from "@module/project-member/models/project-member.model";
import { MeetingModel } from "@module/meeting/models/meeting.model";
import { MeetingParticipantModel } from "@module/meeting-participant/models/meeting-participant.model";
import { TranscriptSegmentModel } from "@module/transcript-segment/models/transcript-segment.model";
import { SpeakerAliasModel } from "@module/speaker-alias/models/speaker-alias.model";
import { MeetingMinutesModel } from "@module/meeting-minutes/models/meeting-minutes.model";
import { ActionItemModel } from "@module/action-item/models/action-item.model";
import { ActionItemCitationModel } from "@module/action-item-citation/models/action-item-citation.model";
import { ActionItemCommentModel } from "@module/action-item-comment/models/action-item-comment.model";
import { ActionItemHistoryModel } from "@module/action-item-history/models/action-item-history.model";
import { ReviewBatchModel } from "@module/review-batch/models/review-batch.model";
import { ReviewItemModel } from "@module/review-item/models/review-item.model";
import { RiskFlagModel } from "@module/risk-flag/models/risk-flag.model";
import { EventAccount } from "@module/event-account/entities/event-account.entity";
import { Event } from "@module/event/entities/event.entity";
import { EventLog } from "@module/event-log/entities/event-log.entity";
import { HamSinhMaModel } from "@module/quy-tac-ma/models/ham-sinh-ma.model";
import { QuyTacMaModel } from "@module/quy-tac-ma/models/quy-tac-ma.model";
import { Model, ModelCtor } from "sequelize-typescript";
import { AuditLogModel } from "../model/audit-log.model";
import { AuthModel } from "../model/auth.model";
import { DataPartitionUserModel } from "../model/data-partition-user.model";
import { DataPartitionModel } from "../model/data-partition.model";
import { FileModel } from "../model/file.model";
import { IncrementModel } from "../model/increment.model";
import { NotificationModel } from "../model/notification.model";
import { OneSignalUserModel } from "../model/one-signal-user.model";
import { SettingModel } from "../model/setting.model";
import TopicModel from "../model/topic.model";
import { UserTopicModel } from "../model/user-topic.model";
import { UserModel } from "../model/user.model";

export const SequelizeModel: ModelCtor<Model>[] = [
    UserModel,
    AuthModel,
    Event,
    EventAccount,
    EventLog,
    FileModel,
    NotificationModel,
    OneSignalUserModel,
    TopicModel,
    UserTopicModel,
    SettingModel,
    IncrementModel,
    QuyTacMaModel,
    HamSinhMaModel,
    AuditLogModel,
    DataPartitionModel,
    DataPartitionUserModel,
    OauthAccountModel,
    WorkspaceModel,
    WorkspaceMemberModel,
    WorkspaceSettingModel,
    ProjectModel,
    ProjectMemberModel,
    MeetingModel,
    MeetingParticipantModel,
    TranscriptSegmentModel,
    SpeakerAliasModel,
    MeetingMinutesModel,
    ActionItemModel,
    ActionItemCitationModel,
    ActionItemCommentModel,
    ActionItemHistoryModel,
    ReviewBatchModel,
    ReviewItemModel,
    RiskFlagModel,
    UserSessionModel,
    AgendaItemModel,
    RecordingConsentModel,
    UploadSessionModel,
    RecordingSegmentModel,
    BotSessionModel,
    TranscriptVersionModel,
    NoteModel,
    MinutesVersionModel,
    DecisionModel,
    DecisionCitationModel,
    TaskDependencyModel,
    ProcessingJobModel,
    OutboxEventModel,
    ProcessedMessageModel,
];
