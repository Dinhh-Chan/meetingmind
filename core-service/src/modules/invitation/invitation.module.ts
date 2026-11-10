import { UserModule } from "@module/user/user.module";
import { WorkspaceMemberModule } from "@module/workspace-member/workspace-member.module";
import { WorkspaceModule } from "@module/workspace/workspace.module";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { InvitationService } from "./invitation.service";

@Module({
    imports: [JwtModule.register({}), UserModule, WorkspaceModule, WorkspaceMemberModule],
    providers: [InvitationService],
    exports: [InvitationService],
})
export class InvitationModule {}
