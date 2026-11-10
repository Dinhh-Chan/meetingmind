import { OperatorType, compareUserPassword } from "@common/constant";
import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { BaseService } from "@config/service/base.service";
import {
    AccessSsoJwtPayload,
    RefreshSsoJwtPayload,
} from "@module/auth/auth.interface";
import { Auth } from "@module/auth/entities/auth.entity";
import { AuthRepository } from "@module/auth/repository/auth-repository.interface";
import { Entity } from "@module/repository";
import { CreateDocument } from "@module/repository/common/base-repository.interface";
import { InjectRepository } from "@module/repository/common/repository";
import { UserRepository } from "@module/user/repository/user-repository.interface";
import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { LogoutDto } from "@module/auth/dto/logout.dto";
import { BaseTransaction } from "@module/repository/common/base-transaction.interface";
import { InjectTransaction } from "@module/repository/common/transaction";
import { InvitationService } from "@module/invitation/invitation.service";
import { OauthProvider } from "@module/oauth-account/common/constant";
import { OauthAccountService } from "@module/oauth-account/services/oauth-account.service";
import { SystemRole } from "@module/user/common/constant";
import { User } from "@module/user/entities/user.entity";
import { WorkspacePlan } from "@module/workspace/common/constant";
import { WorkspaceService } from "@module/workspace/services/workspace.service";
import { WorkspaceMemberStatus } from "@module/workspace-member/common/constant";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import moment from "moment";
import { UAParser } from "ua-parser-js";
import { ClientPlatform } from "./common/constant";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { LoginRequestDto } from "./dto/login-request.dto";
import { LoginResponseDto } from "./dto/login-response.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

/** Khoá công khai Google ký ID token; jose tự cache và làm mới. */
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const slugOf = (name: string) =>
    name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "workspace";

@Injectable()
export class AuthService extends BaseService<Auth, AuthRepository> {
    constructor(
        @InjectRepository(Entity.AUTH)
        private readonly authRepository: AuthRepository,
        @InjectRepository(Entity.USER)
        private readonly userRepository: UserRepository,
        @InjectTransaction()
        private readonly authTransaction: BaseTransaction,
        private readonly configService: ConfigService<Configuration>,
        private readonly jwtService: JwtService,
        private readonly oauthAccountService: OauthAccountService,
        private readonly workspaceService: WorkspaceService,
        private readonly workspaceMemberService: WorkspaceMemberService,
        private readonly invitationService: InvitationService,
    ) {
        super(authRepository, { transaction: authTransaction });
    }

    async login(req: Request, dto: LoginRequestDto): Promise<LoginResponseDto> {
        const user = await this.validatePassword(dto.username, dto.password);
        const auth = await this.createEmptyAuth(user, {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            origin: req.headers["origin"],
            platform: dto.platform,
        });
        const { accessToken, refreshToken } = await this.generateTokens(
            user,
            auth,
        );
        return this.getLoginInfo(accessToken, refreshToken);
    }

    /**
     * Đăng nhập bằng Google (ID token từ Google Identity Services).
     *
     * Tìm theo liên kết Google, rồi theo email (Google đã xác minh email nên
     * gắn vào tài khoản sẵn có). Chưa có thì tạo tài khoản; có lời mời hợp lệ
     * thì vào workspace được mời, không thì tạo workspace riêng.
     */
    async loginWithGoogle(req: Request, dto: GoogleLoginDto) {
        const profile = await this.verifyGoogleCredential(dto.credential);
        let user = await this.findGoogleUser(profile);
        const isNew = !user;
        if (!user) {
            user = await this.userRepository.create({
                username: profile.email,
                email: profile.email,
                fullname: profile.name,
                firstname: profile.givenName,
                lastname: profile.familyName,
                systemRole: SystemRole.USER,
            });
        }
        await this.linkGoogle(user, profile);

        let workspaceId: string | undefined;
        if (dto.inviteToken) {
            workspaceId = (await this.invitationService.accept(user._id, dto.inviteToken)).workspaceId;
        } else if (isNew || !(await this.hasWorkspace(user._id))) {
            const name = `Workspace của ${user.fullname || profile.email}`;
            const workspace = await this.workspaceService.create(user, {
                name,
                slug: `${slugOf(name)}-${Date.now().toString(36)}`,
                plan: WorkspacePlan.FREE,
                timezone: "Asia/Ho_Chi_Minh",
            });
            workspaceId = workspace._id;
        }

        const auth = await this.createEmptyAuth(user, {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            origin: req.headers["origin"],
            platform: dto.platform ?? ClientPlatform.WEB,
        });
        const { accessToken, refreshToken } = await this.generateTokens(user, auth);
        return { ...this.getLoginInfo(accessToken, refreshToken), workspaceId };
    }

    private async verifyGoogleCredential(credential: string) {
        const { clientId } = this.configService.get("google", { infer: true });
        if (!clientId) throw ApiError.BadRequest("error-google-not-configured");
        let payload: Record<string, unknown>;
        try {
            ({ payload } = await jwtVerify(credential, GOOGLE_JWKS, {
                issuer: ["https://accounts.google.com", "accounts.google.com"],
                audience: clientId,
            }));
        } catch {
            throw ApiError.Unauthorized("error-google-token-invalid");
        }
        const email = String(payload.email ?? "").trim().toLowerCase();
        if (!email || payload.email_verified !== true) {
            throw ApiError.Unauthorized("error-google-email-unverified");
        }
        return {
            sub: String(payload.sub),
            email,
            name: String(payload.name ?? "") || email.split("@")[0],
            givenName: payload.given_name ? String(payload.given_name) : undefined,
            familyName: payload.family_name ? String(payload.family_name) : undefined,
        };
    }

    private async findGoogleUser(profile: { sub: string; email: string }) {
        const link = await this.oauthAccountService.getOne(null, {
            provider: OauthProvider.GOOGLE,
            providerAccountId: profile.sub,
        });
        if (link) {
            const linked = await this.userRepository.getById(link.userId);
            if (linked) return linked;
        }
        return (
            (await this.userRepository.getOne({ email: profile.email }, { enableDataPartition: false })) ??
            (await this.userRepository.getOne({ username: profile.email }, { enableDataPartition: false }))
        );
    }

    private async linkGoogle(user: User, profile: { sub: string; email: string }) {
        const existing = await this.oauthAccountService.getOne(null, {
            provider: OauthProvider.GOOGLE,
            providerAccountId: profile.sub,
        });
        if (!existing) {
            await this.oauthAccountService.create(null, {
                userId: user._id,
                provider: OauthProvider.GOOGLE,
                providerAccountId: profile.sub,
                email: profile.email,
            });
        }
    }

    private async hasWorkspace(userId: string) {
        const membership = await this.workspaceMemberService.getOne(null, {
            userId,
            status: WorkspaceMemberStatus.ACTIVE,
        });
        return !!membership;
    }

    async logout(dto: LogoutDto) {
        const invoke = await this.revokeAuthByRefreshToken(dto.refreshToken);
        if (invoke) {
            return;
        } else {
            throw ApiError.Unauthorized("error-unauthorized");
        }
    }

    async createEmptyAuth(
        user: User,
        data: Pick<Auth, "ip" | "userAgent" | "origin" | "platform">,
    ) {
        const { ip, userAgent, origin, platform } = data;
        const userAgentData = new UAParser(userAgent).getResult();
        const doc: CreateDocument<Auth> = {
            ip,
            userAgent: userAgentData,
            origin,
            platform,
            user: user._id,
        };
        return this.authRepository.create(doc);
    }

    async generateTokens(user: User, auth: Auth) {
        if (!user) {
            throw new UnauthorizedException();
        }
        const { refreshExp } = this.configService.get("jwt", { infer: true });
        if (!auth.exp) {
            auth.exp = Math.floor(
                moment().add(refreshExp, "second").valueOf() / 1000,
            );
        }
        await this.authRepository.updateById(auth._id, auth);
        return this.getTokens(auth, user);
    }

    private async getTokens(auth: Auth, user: User) {
        if (!auth.jti && !auth.exp) {
            throw new BadRequestException();
        }
        const { secret, exp, refreshSecret } = this.configService.get("jwt", {
            infer: true,
        });
        const accessPayload: AccessSsoJwtPayload = {
            jti: auth.jti,
            sub: user._id,
            auth: auth._id,
            username: user.username,
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            scope: undefined,
            platform: auth.platform,
            systemRole: user.systemRole,
        };
        const refreshPayload: RefreshSsoJwtPayload = {
            jti: auth.jti,
            sub: user._id,
            auth: auth._id,
            username: user.username,
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            scope: null,
            platform: auth.platform,
            systemRole: user.systemRole,
            exp: auth.exp,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessPayload, {
                secret,
                expiresIn: exp,
            }),
            this.jwtService.signAsync(refreshPayload, {
                secret: refreshSecret,
            }),
        ]);
        return { accessToken, refreshToken };
    }

    async refreshTokens(dto: RefreshTokenDto) {
        const payload = this.verifyRefreshToken(dto.refreshToken);
        const auth = await this.authRepository.getOne({
            _id: payload.auth,
            jti: payload.jti,
        });
        if (auth) {
            const user = await this.userRepository.getById(payload.sub);
            const { accessToken, refreshToken } = await this.generateTokens(
                user,
                auth,
            );
            return this.getLoginInfo(accessToken, refreshToken);
        } else {
            throw ApiError.Unauthorized("error-unauthorized");
        }
    }

    private getLoginInfo(
        accessToken: string,
        refreshToken: string,
    ): LoginResponseDto {
        const newAccessPayload = this.jwtService.decode(
            accessToken,
        ) as AccessSsoJwtPayload;
        const newRefreshPayload = this.jwtService.decode(
            refreshToken,
        ) as RefreshSsoJwtPayload;
        return {
            accessToken,
            refreshToken,
            accessExpireAt: newAccessPayload.exp,
            refreshExpireAt: newRefreshPayload.exp,
        };
    }

    async revokeAuthByRefreshToken(refreshToken: string) {
        const payload = this.verifyRefreshToken(refreshToken);
        return this.authRepository.deleteOne({
            _id: payload.auth,
            jti: payload.jti,
        });
    }

    private verifyRefreshToken(refreshToken: string) {
        const { refreshSecret } = this.configService.get("jwt", {
            infer: true,
        });
        try {
            const payload = this.jwtService.verify<RefreshSsoJwtPayload>(
                refreshToken,
                {
                    secret: refreshSecret,
                },
            );
            return payload;
        } catch (err) {
            console.error(err.message);
            throw ApiError.Unauthorized("error-unauthorized");
        }
    }

    private async validatePassword(username: string, password: string) {
        const user = await this.userRepository.getOne(
            { username },
            { enableDataPartition: false },
        );
        if (user && !user.password) {
            // Tài khoản tạo bằng Google chưa đặt mật khẩu: báo rõ thay vì lỗi so khớp.
            throw ApiError.BadRequest("error-password-not-set");
        }
        if (user) {
            const match = await compareUserPassword(password, user.password);
            if (match) {
                return user;
            }
        }
        throw ApiError.Unauthorized("error-unauthorized");
    }

    async testAuth() {
        const auth = await this.authRepository.getOne(
            {
                $and: [
                    {
                        $or: [{ ip: "a" }, { ip: { $in: ["d", "c"] } }],
                        ip: "c",
                    },
                    {
                        ip: "c",
                    },
                ],
            },
            {
                filters: [
                    {
                        operator: OperatorType.OR,
                        filters: [
                            {
                                field: "ip",
                                operator: OperatorType.EQUAL,
                                values: ["d"],
                            },
                            {
                                field: "ip",
                                operator: OperatorType.EQUAL,
                                values: ["c"],
                            },
                        ],
                    },
                ],
            },
        );
        // return auth;
        return this.authRepository.updateById(auth._id, {
            userAgent: { x: 1 },
            $inc: { exp: -1, test: 1 },
        });
    }
}
