import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { UserSqlRepository } from "@module/user/repository/user-sql.repository";
import { UserModule } from "@module/user/user.module";
import { InvitationModule } from "@module/invitation/invitation.module";
import { OauthAccountModule } from "@module/oauth-account/oauth-account.module";
import { WorkspaceMemberModule } from "@module/workspace-member/workspace-member.module";
import { WorkspaceModule } from "@module/workspace/workspace.module";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthPublicController } from "./auth-public.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./common/jwt.strategy";
import { AuthSqlRepository } from "./repository/auth-sql.repository";

@Module({
    imports: [
        JwtModule.register({}),
        UserModule,
        ScheduleModule.forRoot(),
        OauthAccountModule,
        WorkspaceModule,
        WorkspaceMemberModule,
        InvitationModule,
    ],
    providers: [
        AuthService,
        RepositoryProvider(Entity.AUTH, AuthSqlRepository),
        RepositoryProvider(Entity.USER, UserSqlRepository),
        TransactionProvider(SqlTransaction),
        JwtStrategy,
    ],
    controllers: [AuthPublicController, AuthController],
})
export class AuthModule {}
