import { MeetingAccessModule } from "@module/meeting-access/meeting-access.module";
import { MeetingModule } from "@module/meeting/meeting.module";
import { ProjectMemberModule } from "@module/project-member/project-member.module";
import { WorkspaceMemberModule } from "@module/workspace-member/workspace-member.module";
import { Global, Module } from "@nestjs/common";
import { PermissionGuard } from "./guards/permission.guard";
import { PermissionService } from "./services/permission.service";

/**
 * Core là nơi quyết định quyền nghiệp vụ (ARCHITECTURE.md mục 6).
 * Module này @Global để mọi service khác dùng được PermissionService mà
 * không phải khai import vòng quanh.
 */
@Global()
@Module({
    imports: [
        WorkspaceMemberModule,
        ProjectMemberModule,
        MeetingAccessModule,
        MeetingModule,
    ],
    providers: [PermissionService, PermissionGuard],
    exports: [PermissionService, PermissionGuard],
})
export class PermissionModule {}
