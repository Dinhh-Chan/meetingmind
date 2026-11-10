import { JwtService } from "@nestjs/jwt";
import { jwtVerify } from "jose";
import { AuthService } from "./auth.service";

jest.mock("jose", () => ({
    createRemoteJWKSet: jest.fn(() => "jwks"),
    jwtVerify: jest.fn(),
}));
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }), { virtual: true });
// p-limit chỉ có bản ESM, ts-jest (CommonJS) không nạp được; BaseService import nó cho phần xuất Excel.
jest.mock("p-limit", () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));

const verified = jwtVerify as jest.Mock;

const googlePayload = (extra: Record<string, unknown> = {}) => ({
    payload: {
        sub: "google-123",
        email: "Lan@Example.com",
        email_verified: true,
        name: "Nguyễn Lan",
        ...extra,
    },
});

function setup({ clientId = "client-id" } = {}) {
    const user = { _id: "u1", username: "lan@example.com", email: "lan@example.com", fullname: "Nguyễn Lan" };
    const userRepository = {
        create: jest.fn(async (dto) => ({ _id: "u-new", ...dto })),
        getById: jest.fn(async () => user),
        getOne: jest.fn(async () => null),
    };
    const authRepository = {
        create: jest.fn(async (doc) => ({ _id: "auth1", jti: "jti1", ...doc })),
        updateById: jest.fn(async () => undefined),
    };
    const config: Record<string, unknown> = {
        google: { clientId },
        jwt: { secret: "s", exp: 3600, refreshSecret: "r", refreshExp: 3600 },
    };
    const oauthAccountService = { getOne: jest.fn(async () => null), create: jest.fn(async () => ({})) };
    const workspaceService = { create: jest.fn(async () => ({ _id: "ws-new" })) };
    const workspaceMemberService = { getOne: jest.fn(async () => null) };
    const invitationService = { accept: jest.fn(async () => ({ workspaceId: "ws-invited" })) };
    const service = new AuthService(
        authRepository as never,
        userRepository as never,
        {} as never,
        { get: (key: string) => config[key] } as never,
        new JwtService(),
        oauthAccountService as never,
        workspaceService as never,
        workspaceMemberService as never,
        invitationService as never,
    );
    const req = { ip: "127.0.0.1", headers: { "user-agent": "jest", origin: "http://localhost" } } as never;
    return { service, req, user, userRepository, oauthAccountService, workspaceService, workspaceMemberService, invitationService };
}

describe("AuthService.loginWithGoogle", () => {
    beforeEach(() => verified.mockReset());

    it("tài khoản Google mới: tạo người dùng, liên kết Google, tạo workspace riêng", async () => {
        verified.mockResolvedValue(googlePayload());
        const t = setup();
        const res = await t.service.loginWithGoogle(t.req, { credential: "id-token" });

        expect(verified).toHaveBeenCalledWith("id-token", "jwks", expect.objectContaining({ audience: "client-id" }));
        expect(t.userRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ username: "lan@example.com", email: "lan@example.com", fullname: "Nguyễn Lan" }),
        );
        expect(t.oauthAccountService.create).toHaveBeenCalledWith(null, {
            userId: "u-new",
            provider: "google",
            providerAccountId: "google-123",
            email: "lan@example.com",
        });
        expect(t.workspaceService.create).toHaveBeenCalledWith(
            expect.objectContaining({ _id: "u-new" }),
            expect.objectContaining({ name: "Workspace của Nguyễn Lan", plan: "free" }),
        );
        expect(res.workspaceId).toBe("ws-new");
        expect(res.accessToken).toEqual(expect.any(String));
    });

    it("có lời mời: vào workspace được mời, không tạo workspace riêng", async () => {
        verified.mockResolvedValue(googlePayload());
        const t = setup();
        const res = await t.service.loginWithGoogle(t.req, { credential: "id-token", inviteToken: "invite" });

        expect(t.invitationService.accept).toHaveBeenCalledWith("u-new", "invite");
        expect(t.workspaceService.create).not.toHaveBeenCalled();
        expect(res.workspaceId).toBe("ws-invited");
    });

    it("email đã có tài khoản: gắn Google vào tài khoản đó, không tạo người dùng hay workspace mới", async () => {
        verified.mockResolvedValue(googlePayload());
        const t = setup();
        t.userRepository.getOne.mockResolvedValueOnce(t.user as never);
        t.workspaceMemberService.getOne.mockResolvedValue({ _id: "m1" } as never);
        const res = await t.service.loginWithGoogle(t.req, { credential: "id-token" });

        expect(t.userRepository.create).not.toHaveBeenCalled();
        expect(t.oauthAccountService.create).toHaveBeenCalledWith(null, expect.objectContaining({ userId: "u1" }));
        expect(t.workspaceService.create).not.toHaveBeenCalled();
        expect(res.workspaceId).toBeUndefined();
    });

    it("token sai chữ ký hoặc sai Client ID: từ chối", async () => {
        verified.mockRejectedValue(new Error("signature"));
        const t = setup();
        await expect(t.service.loginWithGoogle(t.req, { credential: "x" })).rejects.toMatchObject({
            code: "error-google-token-invalid",
        });
        expect(t.userRepository.create).not.toHaveBeenCalled();
    });

    it("email Google chưa xác minh: từ chối", async () => {
        verified.mockResolvedValue(googlePayload({ email_verified: false }));
        const t = setup();
        await expect(t.service.loginWithGoogle(t.req, { credential: "x" })).rejects.toMatchObject({
            code: "error-google-email-unverified",
        });
    });

    it("máy chủ chưa cấu hình Client ID: báo chưa bật", async () => {
        const t = setup({ clientId: "" });
        await expect(t.service.loginWithGoogle(t.req, { credential: "x" })).rejects.toMatchObject({
            code: "error-google-not-configured",
        });
        expect(verified).not.toHaveBeenCalled();
    });
});
