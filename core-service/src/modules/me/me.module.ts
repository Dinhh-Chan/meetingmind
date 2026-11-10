import { ActionItemModule } from "@module/action-item/action-item.module";
import { ReviewBatchModule } from "@module/review-batch/review-batch.module";
import { ReviewItemModule } from "@module/review-item/review-item.module";
import { MeetingMinutesModule } from "@module/meeting-minutes/meeting-minutes.module";
import { MeetingParticipantModule } from "@module/meeting-participant/meeting-participant.module";
import { MeetingRecordModule } from "@module/meeting-record/meeting-record.module";
import { MeetingModule } from "@module/meeting/meeting.module";
import { MinutesVersionModule } from "@module/minutes-version/minutes-version.module";
import { ProcessingJobModule } from "@module/processing-job/processing-job.module";
import { ProjectModule } from "@module/project/project.module";
import { ProjectMemberModule } from "@module/project-member/project-member.module";
import { UserModule } from "@module/user/user.module";
import { WorkspaceMemberModule } from "@module/workspace-member/workspace-member.module";
import { WorkspaceModule } from "@module/workspace/workspace.module";
import { Module } from "@nestjs/common";
import { MeController } from "./controllers/me.controller";
import { MeService } from "./services/me.service";

@Module({
    imports: [
        WorkspaceModule,
        WorkspaceMemberModule,
        ProjectModule,
        MeetingModule,
        MeetingMinutesModule,
        MeetingParticipantModule,
        MeetingRecordModule,
        ProjectMemberModule,
        MinutesVersionModule,
        ProcessingJobModule,
        UserModule,
        ActionItemModule,
        ReviewBatchModule,
        ReviewItemModule,
    ],
    controllers: [MeController],
    providers: [MeService],
})
export class MeModule {}
