import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "crypto";
import { createServer, type IncomingMessage, type Server } from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import { createGateway } from "../src/create-gateway";
import { loadConfig } from "../src/gateway/config";

const SECRET = "khoa-thu";

/** Core giả: trả lại những gì nhận được để kiểm tra gateway chuyển tiếp đúng. */
function fakeCore() {
    const seen: { method?: string; url?: string; headers: IncomingMessage["headers"] }[] = [];
    const server = createServer((req, res) => {
        const hash = createHash("sha256");
        let size = 0;
        req.on("data", (chunk: Buffer) => {
            size += chunk.length;
            hash.update(chunk);
        });
        req.on("end", () => {
            seen.push({ method: req.method, url: req.url, headers: req.headers });
            if (req.url?.startsWith("/missing")) {
                res.writeHead(404, { "content-type": "application/json" });
                return res.end(JSON.stringify({ success: false, status: 404 }));
            }
            res.writeHead(200, { "content-type": "application/json", "x-core": "1" });
            res.end(JSON.stringify({ method: req.method, url: req.url, size, sha: hash.digest("hex") }));
        });
    });
    return { server, seen };
}

const listen = (server: Server) =>
    new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));

describe("API gateway", () => {
    let app: INestApplication;
    let core: ReturnType<typeof fakeCore>;
    const token = (exp = "1h") => new JwtService().sign({ sub: "u1", auth: "a1" }, { secret: SECRET, expiresIn: exp });

    beforeAll(async () => {
        core = fakeCore();
        const port = await listen(core.server);
        app = await createGateway({
            ...loadConfig({}),
            coreUrl: `http://127.0.0.1:${port}`,
            jwtSecret: SECRET,
            rateLimit: { windowMs: 60_000, max: 1000, authMax: 3 },
        });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
        core.server.close();
    });

    beforeEach(() => (core.seen.length = 0));

    it("route công khai đi thẳng tới core, không cần token", async () => {
        const res = await request(app.getHttpServer()).get("/auth/providers").expect(200);
        expect(res.body.url).toBe("/auth/providers");
        expect(res.headers["x-request-id"]).toBeTruthy();
    });

    it("route cần đăng nhập: thiếu token thì 401 tại gateway, không gọi core", async () => {
        const res = await request(app.getHttpServer()).get("/me/workspaces").expect(401);
        expect(res.body).toMatchObject({ success: false, status: 401, code: "error-unauthorized" });
        expect(core.seen).toHaveLength(0);
    });

    it("token sai chữ ký hoặc hết hạn: 401", async () => {
        const forged = new JwtService().sign({ sub: "u1" }, { secret: "khoa-khac" });
        await request(app.getHttpServer()).get("/me/workspaces").set("Authorization", `Bearer ${forged}`).expect(401);
        await request(app.getHttpServer()).get("/me/workspaces").set("Authorization", `Bearer ${token("-10s")}`).expect(401);
        expect(core.seen).toHaveLength(0);
    });

    it("token hợp lệ: chuyển tiếp giữ query, header Authorization, gắn mã request và IP", async () => {
        const res = await request(app.getHttpServer())
            .get("/me/meetings?workspaceId=w1&x=%C4%91")
            .set("Authorization", `Bearer ${token()}`)
            .set("X-Request-Id", "req-abcdef12")
            .expect(200);
        expect(res.body.url).toBe("/me/meetings?workspaceId=w1&x=%C4%91");
        expect(res.headers["x-core"]).toBe("1");
        expect(res.headers["x-request-id"]).toBe("req-abcdef12");
        const seen = core.seen[0].headers;
        expect(seen.authorization).toMatch(/^Bearer ey/);
        expect(seen["x-request-id"]).toBe("req-abcdef12");
        expect(seen["x-forwarded-for"]).toBeTruthy();
    });

    it("tệp lớn (8 MB) đi nguyên vẹn qua gateway", async () => {
        const body = Buffer.alloc(8 * 1024 * 1024, 7);
        const res = await request(app.getHttpServer())
            .post("/media-file/upload")
            .set("Authorization", `Bearer ${token()}`)
            .set("Content-Type", "application/octet-stream")
            .send(body)
            .expect(200);
        expect(res.body.size).toBe(body.length);
        expect(res.body.sha).toBe(createHash("sha256").update(body).digest("hex"));
    });

    it("JSON body và mã lỗi của core được trả nguyên", async () => {
        const res = await request(app.getHttpServer())
            .post("/missing/thing")
            .set("Authorization", `Bearer ${token()}`)
            .send({ a: 1 })
            .expect(404);
        expect(res.body).toEqual({ success: false, status: 404 });
    });

    it("kênh nội bộ /microservice không gọi được từ ngoài", async () => {
        await request(app.getHttpServer()).get("/microservice/client").set("Authorization", `Bearer ${token()}`).expect(404);
        expect(core.seen).toHaveLength(0);
    });

    it("đăng nhập quá nhiều lần trong một phút: 429 kèm Retry-After", async () => {
        const server = app.getHttpServer();
        for (let i = 0; i < 3; i++) await request(server).post("/auth/login").send({}).expect(200);
        const res = await request(server).post("/auth/login").send({}).expect(429);
        expect(res.body.code).toBe("error-too-many-requests");
        expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("health báo core còn sống, không đi qua proxy", async () => {
        const res = await request(app.getHttpServer()).get("/gateway/health").expect(200);
        expect(res.body).toMatchObject({ status: "ok", upstreams: { core: { ok: true } } });
        expect(core.seen.map((s) => s.url)).toEqual(["/app/timestamp"]);
    });
});

describe("API gateway khi core không chạy", () => {
    it("trả 502 dạng JSON thay vì treo", async () => {
        const app = await createGateway({ ...loadConfig({}), coreUrl: "http://127.0.0.1:9", jwtSecret: SECRET });
        await app.init();
        const res = await request(app.getHttpServer()).get("/auth/providers").expect(502);
        expect(res.body).toMatchObject({ success: false, status: 502, code: "error-bad-gateway" });
        await request(app.getHttpServer()).get("/gateway/health").expect(503);
        await app.close();
    });
});
