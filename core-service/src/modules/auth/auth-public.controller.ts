import { ApiRecordResponse } from "@common/decorator/api.decorator";
import { AuthService } from "@module/auth/auth.service";
import { UserService } from "@module/user/service/user.service";
import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
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
    ) {}

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
