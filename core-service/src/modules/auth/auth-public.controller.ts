import { ApiRecordResponse } from "@common/decorator/api.decorator";
import { Configuration } from "@config/configuration";
import { AuthService } from "@module/auth/auth.service";
import { InvitationService } from "@module/invitation/invitation.service";
import { MailService } from "@module/mail/mail.service";
import { UserService } from "@module/user/service/user.service";
import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { LoginRequestDto } from "./dto/login-request.dto";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { Auth } from "./entities/auth.entity";

@Controller("auth")
@ApiTags("auth")
export class AuthPublicController {
    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly invitationService: InvitationService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService<Configuration>,
    ) {}

    /** Cách đăng nhập máy chủ đang bật, để giao diện hiện nút Google khi có. */
    @Get("providers")
    providers() {
        return {
            google: this.configService.get("google", { infer: true }).clientId || null,
            inviteByEmail: this.mailService.enabled,
        };
    }

    @Post("google")
    async loginWithGoogle(@Req() req: Request, @Body() dto: GoogleLoginDto) {
        return this.authService.loginWithGoogle(req, dto);
    }

    /** Ai mời, vào workspace nào: trang /invite hiện trước khi đăng nhập. */
    @Get("invite")
    async describeInvite(@Query("token") token: string) {
        return this.invitationService.describe(token);
    }

    /**
     * Tự đăng ký luôn tạo tài khoản thường. Trước đây đăng ký đi qua
     * `POST /user` không cần đăng nhập và nhận cả `systemRole` từ client.
     */
    @Post("register")
    async register(@Body() dto: RegisterDto) {
        return this.userService.register(dto);
    }

    @ApiRecordResponse(LoginResponseDto)
    @Post("login")
    async login(@Req() req: Request, @Body() dto: LoginRequestDto) {
        return this.authService.login(req, dto);
    }

    @ApiRecordResponse(Auth)
    @Post("logout")
    async logout(@Body() dto: LogoutDto) {
        await this.authService.logout(dto);
    }

    @ApiRecordResponse(LoginRequestDto)
    @Post("refresh")
    async refreshToken(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshTokens(dto);
    }
}
