/* eslint-disable max-classes-per-file -- test cần nhiều lớp giả */
import { ExternalTaskLink } from "@module/external-task-link/entities/external-task-link.entity";
import { Integration } from "@module/integration/entities/integration.entity";
import {
    EventEnvelope,
    EventType,
    MEETINGMIND_EXCHANGE,
    TaskSyncRequestedPayload,
} from "@module/messaging/common/constant";
import { SyncJobStatus } from "@module/sync-job/common/constant";
import { SyncJob } from "@module/sync-job/entities/sync-job.entity";
import { Logger, LoggerService } from "@nestjs/common";
import {
    buildTaskSyncConfig,
    DEFAULT_TRELLO_LIST_NAME,
    TaskSyncConfig,
} from "../common/config";
import { trelloMarker } from "../common/format";
import {
    HttpClient,
    HttpRequestOptions,
    HttpResponse,
} from "./http-client.service";
import { IntegrationRegistryService } from "./integration-registry.service";
import { TaskSyncService } from "./task-sync.service";
import { TelegramClient } from "./telegram.client";
import { TrelloClient } from "./trello.client";

// Service Sequelize chỉ dùng làm token DI; thay bằng lớp rỗng để test không
// kéo theo BaseService (phụ thuộc ESM mà Jest không đọc được) và DB thật.
jest.mock("@module/integration/services/integration.service", () => ({
    IntegrationService: class {},
}));
jest.mock("@module/sync-job/services/sync-job.service", () => ({
    SyncJobService: class {},
}));
jest.mock(
    "@module/external-task-link/services/external-task-link.service",
    () => ({
        ExternalTaskLinkService: class {},
    }),
);

const TRELLO_KEY = "trello-key-SECRET123";
const TRELLO_TOKEN = "trello-token-SECRET456";
const BOT_TOKEN = "123456:BOT-SECRET-789";
const SECRETS = [TRELLO_KEY, TRELLO_TOKEN, BOT_TOKEN];
const LIST_ID = "list-1";
const BOARD_ID = "board-1";
const CHAT_ID = "-1001";

/* ------------------------------------------------------------ fakes */

/** Thay cho service/repository Sequelize: lưu trong bộ nhớ. */
class MemoryStore<E extends { _id: string }> {
    rows: E[] = [];
    private seq = 0;

    private matches(row: E, cond: Record<string, any>) {
        return Object.entries(cond).every(([k, v]) => row[k] === v);
    }

    getOne = jest.fn(async (_user: unknown, cond: Record<string, any>) => {
        const row = this.rows.find((r) => this.matches(r, cond));
        return row ? structuredClone(row) : null;
    });

    create = jest.fn(async (_user: unknown, dto: Partial<E>) => {
        const row = { _id: `row-${++this.seq}`, ...dto } as E;
        this.rows.push(row);
        return structuredClone(row);
    });

    updateById = jest.fn(
        async (_user: unknown, id: string, update: Partial<E>) => {
            const row = this.rows.find((r) => r._id === id);
            Object.assign(row, update);
            return structuredClone(row);
        },
    );
}

const ok = <T>(data: T, status = 200): HttpResponse<T> => ({
    status,
    ok: status < 400,
    data,
});

/** Giả lập Trello và Telegram ở tầng HttpClient. */
class FakeApis {
    trelloCards: Array<{
        id: string;
        name: string;
        desc: string;
        shortUrl: string;
        url: string;
    }> = [];
    trelloLists = [{ id: "other-list", name: "Đang làm" }];
    telegramUpdates: any[] = [];
    sentMessages: any[] = [];
    createdCards: any[] = [];
    createdLists: any[] = [];
    failCreateCard: HttpResponse | null = null;

    request = jest.fn(
        async (
            url: string,
            opts: HttpRequestOptions = {},
        ): Promise<HttpResponse> => {
            const u = new URL(url);
            const method = opts.method ?? "GET";
            if (u.host === "api.trello.com") {
                expect(opts.query).toMatchObject({
                    key: TRELLO_KEY,
                    token: TRELLO_TOKEN,
                });
                const path = u.pathname.replace(/^\/1/, "");
                const body = opts.body as any;
                if (method === "GET" && path === `/lists/${LIST_ID}/cards`) {
                    return ok(this.trelloCards);
                }
                if (method === "GET" && path === `/boards/${BOARD_ID}/lists`) {
                    return ok(this.trelloLists);
                }
                if (method === "POST" && path === "/lists") {
                    this.createdLists.push(body);
                    const list = { id: LIST_ID, name: body.name };
                    this.trelloLists.push(list);
                    return ok(list);
                }
                if (method === "POST" && path === "/cards") {
                    if (this.failCreateCard) {
                        return this.failCreateCard;
                    }
                    this.createdCards.push(body);
                    const n = this.trelloCards.length + 1;
                    const card = {
                        id: `card-${n}`,
                        name: body.name,
                        desc: body.desc,
                        shortUrl: `https://trello.com/c/short${n}`,
                        url: `https://trello.com/c/short${n}/long-name`,
                    };
                    this.trelloCards.push(card);
                    return ok(card);
                }
            }
            if (u.host === "api.telegram.org") {
                expect(u.pathname.startsWith(`/bot${BOT_TOKEN}/`)).toBe(true);
                const apiMethod = u.pathname.split("/").pop();
                if (apiMethod === "sendMessage") {
                    this.sentMessages.push(opts.body);
                    return ok({ ok: true, result: { message_id: 77 } });
                }
                if (apiMethod === "getUpdates") {
                    return ok({ ok: true, result: this.telegramUpdates });
                }
            }
            throw new Error(
                `Gọi API không mong đợi: ${method} ${u.host}${u.pathname}`,
            );
        },
    );
}

/* ------------------------------------------------------------ helpers */

const fullConfig = (
    overrides: {
        trello?: Partial<TaskSyncConfig["trello"]> | null;
        telegram?: Partial<TaskSyncConfig["telegram"]> | null;
    } = {},
): TaskSyncConfig => ({
    trello:
        overrides.trello === null
            ? null
            : {
                  apiKey: TRELLO_KEY,
                  token: TRELLO_TOKEN,
                  listId: LIST_ID,
                  listName: DEFAULT_TRELLO_LIST_NAME,
                  ...overrides.trello,
              },
    telegram:
        overrides.telegram === null
            ? null
            : { botToken: BOT_TOKEN, chatId: CHAT_ID, ...overrides.telegram },
});

const makeEnvelope = (): EventEnvelope<TaskSyncRequestedPayload> => ({
    eventId: "evt-1",
    eventType: EventType.TASK_SYNC_REQUESTED as any,
    eventVersion: 1,
    occurredAt: "2026-11-05T03:00:00.000Z",
    workspaceId: "ws-1",
    correlationId: "corr-1",
    payload: {
        actionItemId: "ai-1",
        meetingId: "m-1",
        idempotencyKey: "ai-1:push",
        task: {
            title: "Gửi báo giá <bản 2> cho khách & đối tác",
            description: "Kèm bảng giá mới",
            assigneeName: "Lan",
            // 00:00 ngày 07/11 giờ Việt Nam
            deadline: "2026-11-06T17:00:00.000Z",
            priority: "high",
            meetingTitle: "Họp tuần",
            sourceQuote: "Lan gửi báo giá trước thứ Sáu nhé",
        },
    },
});

function setup(config: TaskSyncConfig) {
    const apis = new FakeApis();
    const integrations = new MemoryStore<Integration>();
    const jobs = new MemoryStore<SyncJob>();
    const links = new MemoryStore<ExternalTaskLink>();
    const amqp = { publish: jest.fn().mockResolvedValue(true) };
    const http = { request: apis.request } as unknown as HttpClient;
    const registry = new IntegrationRegistryService(
        config,
        integrations as any,
    );
    const service = new TaskSyncService(
        config,
        registry,
        jobs as any,
        links as any,
        new TrelloClient(http, config),
        new TelegramClient(http, config),
        amqp as any,
    );
    const published = () => amqp.publish.mock.calls.map((c) => c[2]);
    return {
        apis,
        integrations,
        jobs,
        links,
        amqp,
        registry,
        service,
        published,
    };
}

const trelloCalls = (apis: FakeApis, method: string, path: string) =>
    apis.request.mock.calls.filter(
        ([url, opts]) =>
            (opts?.method ?? "GET") === method &&
            new URL(url).pathname === `/1${path}`,
    );

const telegramCalls = (apis: FakeApis, apiMethod: string) =>
    apis.request.mock.calls.filter(
        ([url]) =>
            new URL(url).host === "api.telegram.org" &&
            new URL(url).pathname.endsWith(`/${apiMethod}`),
    );

/* ------------------------------------------------------------ tests */

describe("TaskSyncService", () => {
    const logs: string[] = [];
    const collect = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
    };
    const capture: LoggerService = {
        log: collect,
        error: collect,
        warn: collect,
        debug: collect,
        verbose: collect,
    };

    beforeAll(() => Logger.overrideLogger(capture));
    beforeEach(() => {
        logs.length = 0;
    });

    it("tạo thẻ Trello rồi báo Telegram kèm link thẻ, phát task.sync.completed", async () => {
        const { apis, jobs, links, integrations, amqp, service } =
            setup(fullConfig());

        const res = await service.handle(makeEnvelope());

        expect(res.results).toEqual([
            {
                provider: "trello",
                status: "synced",
                externalId: "card-1",
                externalUrl: "https://trello.com/c/short1",
            },
            { provider: "telegram", status: "synced", externalId: "77" },
        ]);

        // Thẻ Trello: đúng list, có hạn, mô tả đủ ý và có dòng đánh dấu.
        expect(apis.createdCards).toHaveLength(1);
        const card = apis.createdCards[0];
        expect(card).toMatchObject({
            idList: LIST_ID,
            name: "Gửi báo giá <bản 2> cho khách & đối tác",
            due: "2026-11-06T17:00:00.000Z",
        });
        expect(card.desc).toContain("Kèm bảng giá mới");
        expect(card.desc).toContain("**Người thực hiện:** Lan");
        expect(card.desc).toContain("**Hạn:** 07/11/2026");
        expect(card.desc).toContain("**Ưu tiên:** Cao");
        expect(card.desc).toContain("**Cuộc họp:** Họp tuần");
        expect(card.desc).toContain("> Lan gửi báo giá trước thứ Sáu nhé");
        expect(card.desc.split("\n")).toContain(trelloMarker("ai-1"));

        // Tin Telegram: HTML đã escape, kèm link thẻ.
        expect(apis.sentMessages).toHaveLength(1);
        const msg = apis.sentMessages[0];
        expect(msg.chat_id).toBe(CHAT_ID);
        expect(msg.parse_mode).toBe("HTML");
        expect(msg.text).toContain("🆕 Công việc mới từ cuộc họp");
        expect(msg.text).toContain(
            "<b>Gửi báo giá &lt;bản 2&gt; cho khách &amp; đối tác</b>",
        );
        expect(msg.text).toContain("Người thực hiện: Lan");
        expect(msg.text).toContain("Hạn: 07/11/2026");
        expect(msg.text).toContain("Ưu tiên: Cao");
        expect(msg.text).toContain("Cuộc họp: Họp tuần");
        expect(msg.text).toContain('href="https://trello.com/c/short1"');

        // DB: liên kết thẻ, hai job succeeded, hai dòng integrations.
        expect(links.rows).toEqual([
            expect.objectContaining({
                workspaceId: "ws-1",
                actionItemId: "ai-1",
                provider: "trello",
                externalId: "card-1",
                externalUrl: "https://trello.com/c/short1",
                syncStatus: "synced",
                integrationId: integrations.rows.find(
                    (r) => r.provider === "trello",
                )._id,
            }),
        ]);
        expect(jobs.rows.map((j) => [j.idempotencyKey, j.status])).toEqual([
            ["ai-1:push:trello", SyncJobStatus.SUCCEEDED],
            ["ai-1:push:telegram", SyncJobStatus.SUCCEEDED],
        ]);
        expect(integrations.rows.map((r) => [r.provider, r.status])).toEqual([
            ["trello", "connected"],
            ["telegram", "connected"],
        ]);

        // Event trả về: phong bì mới, giữ workspace và correlation.
        expect(amqp.publish).toHaveBeenCalledTimes(1);
        const [exchange, routingKey, out, options] = amqp.publish.mock.calls[0];
        expect(exchange).toBe(MEETINGMIND_EXCHANGE);
        expect(routingKey).toBe("task.sync.completed");
        expect(out).toMatchObject({
            eventType: "task.sync.completed",
            eventVersion: 1,
            workspaceId: "ws-1",
            correlationId: "corr-1",
            payload: res,
        });
        expect(out.eventId).toMatch(/^[0-9a-f-]{36}$/);
        expect(out.eventId).not.toBe("evt-1");
        expect(Number.isNaN(Date.parse(out.occurredAt))).toBe(false);
        expect(options).toMatchObject({
            messageId: out.eventId,
            persistent: true,
        });
    });

    it("đã có thẻ mang dòng đánh dấu (mất phản hồi lần trước) thì dùng lại, không tạo thẻ mới", async () => {
        const { apis, links, service } = setup(fullConfig());
        apis.trelloCards.push(
            {
                id: "card-other",
                name: "Việc khác",
                desc: `...\n${trelloMarker("ai-10")}`,
                shortUrl: "https://trello.com/c/other",
                url: "https://trello.com/c/other/x",
            },
            {
                id: "card-old",
                name: "Gửi báo giá",
                desc: `mô tả cũ\n\n---\n${trelloMarker("ai-1")}`,
                shortUrl: "https://trello.com/c/old",
                url: "https://trello.com/c/old/x",
            },
        );

        const res = await service.handle(makeEnvelope());

        expect(trelloCalls(apis, "POST", "/cards")).toHaveLength(0);
        expect(res.results[0]).toEqual({
            provider: "trello",
            status: "synced",
            externalId: "card-old",
            externalUrl: "https://trello.com/c/old",
        });
        expect(links.rows[0]).toMatchObject({ externalId: "card-old" });
        expect(apis.sentMessages[0].text).toContain("https://trello.com/c/old");
    });

    it("thiếu thông tin đăng nhập thì skipped, không gọi API, không tạo job", async () => {
        const { apis, jobs, integrations, published, service } = setup(
            fullConfig({ trello: null, telegram: null }),
        );

        const res = await service.handle(makeEnvelope());

        expect(res.results).toEqual([
            { provider: "trello", status: "skipped" },
            { provider: "telegram", status: "skipped" },
        ]);
        expect(apis.request).not.toHaveBeenCalled();
        expect(jobs.rows).toHaveLength(0);
        expect(integrations.rows).toHaveLength(0);
        // Vẫn báo cho Core để giao diện biết là chưa cấu hình.
        expect(published()).toHaveLength(1);
    });

    it("buildTaskSyncConfig: biến rỗng hoặc chỉ có một nửa thì coi như chưa cấu hình", () => {
        expect(buildTaskSyncConfig({}, {})).toEqual({
            trello: null,
            telegram: null,
        });
        expect(
            buildTaskSyncConfig(
                { apiKey: "k", token: "  " },
                { botToken: "", chatId: "1" },
            ),
        ).toEqual({ trello: null, telegram: null });
        expect(
            buildTaskSyncConfig(
                { apiKey: "k", token: "t", boardId: "b" },
                { botToken: "x" },
            ),
        ).toEqual({
            trello: {
                apiKey: "k",
                token: "t",
                listId: undefined,
                boardId: "b",
                listName: DEFAULT_TRELLO_LIST_NAME,
            },
            telegram: { botToken: "x", chatId: undefined },
        });
    });

    it("Trello lỗi không chặn Telegram", async () => {
        const { apis, jobs, links, service } = setup(fullConfig());
        apis.failCreateCard = {
            status: 500,
            ok: false,
            data: "Internal server error",
        };

        const res = await service.handle(makeEnvelope());

        expect(res.results[0]).toMatchObject({
            provider: "trello",
            status: "failed",
        });
        expect(res.results[0].error).toContain("Trello trả lỗi 500");
        expect(res.results[1]).toEqual({
            provider: "telegram",
            status: "synced",
            externalId: "77",
        });
        // Không có thẻ thì tin nhắn không kèm link.
        expect(apis.sentMessages[0].text).not.toContain("<a href");
        expect(links.rows).toHaveLength(0);
        expect(
            jobs.rows.find((j) => j.idempotencyKey === "ai-1:push:trello"),
        ).toMatchObject({
            status: SyncJobStatus.FAILED,
            error: expect.stringContaining("Trello trả lỗi 500"),
        });
    });

    it("không lộ key/token trong lỗi, DB, event và log", async () => {
        const { apis, jobs, integrations, published, service } =
            setup(fullConfig());
        // Lỗi kiểu thư viện mạng in nguyên URL: có cả token Telegram và key Trello.
        apis.request.mockImplementation(async (url: string) => {
            if (url.includes("api.trello.com")) {
                return {
                    status: 401,
                    ok: false,
                    data: `invalid token ${TRELLO_TOKEN} for key ${TRELLO_KEY}`,
                };
            }
            throw new Error(
                `request to https://api.telegram.org/bot${BOT_TOKEN}/sendMessage failed ` +
                    `(${encodeURIComponent(BOT_TOKEN)}) key=${TRELLO_KEY}`,
            );
        });

        const res = await service.handle(makeEnvelope());

        expect(res.results.map((r) => r.status)).toEqual(["failed", "failed"]);
        // Lỗi đã được ghi log thật, nên kiểm log mới có nghĩa.
        expect(logs.some((l) => l.includes("thất bại"))).toBe(true);
        const everything = JSON.stringify({
            results: res.results,
            jobs: jobs.rows,
            integrations: integrations.rows,
            published: published(),
            logs,
        });
        for (const secret of SECRETS) {
            expect(everything).not.toContain(secret);
            expect(everything).not.toContain(encodeURIComponent(secret));
        }
        expect(res.results[0].error).toContain("***");
        expect(res.results[1].error).toContain("***");
    });

    it("sync_job đã succeeded thì dùng lại kết quả, không gọi API lần nữa", async () => {
        const { apis, published, service } = setup(fullConfig());
        await service.handle(makeEnvelope());
        const firstCalls = apis.request.mock.calls.length;

        // Core phát lại cùng công việc với eventId mới.
        const again = { ...makeEnvelope(), eventId: "evt-2" };
        const res = await service.handle(again);

        expect(apis.request.mock.calls.length).toBe(firstCalls);
        expect(apis.createdCards).toHaveLength(1);
        expect(apis.sentMessages).toHaveLength(1);
        expect(res.results).toEqual(published()[0].payload.results);
        expect(published()).toHaveLength(2);
    });

    it("job lỗi lần trước thì thử lại và tăng retryCount", async () => {
        const { apis, jobs, service } = setup(fullConfig());
        apis.failCreateCard = { status: 503, ok: false, data: "busy" };
        await service.handle(makeEnvelope());
        apis.failCreateCard = null;

        const res = await service.handle({
            ...makeEnvelope(),
            eventId: "evt-2",
        });

        expect(res.results[0]).toMatchObject({
            provider: "trello",
            status: "synced",
        });
        expect(
            jobs.rows.find((j) => j.idempotencyKey === "ai-1:push:trello"),
        ).toMatchObject({
            status: SyncJobStatus.SUCCEEDED,
            retryCount: 1,
            error: null,
        });
        // Telegram đã gửi ở lần đầu: không gửi lại.
        expect(apis.sentMessages).toHaveLength(1);
    });

    it("có TELEGRAM_CHAT_ID thì chỉ gửi tin, không bao giờ gọi getUpdates", async () => {
        // Token có thể dùng chung với ứng dụng khác đang long-poll getUpdates.
        const { apis, service } = setup(fullConfig());

        await service.handle(makeEnvelope());
        await service.handle({
            ...makeEnvelope(),
            eventId: "evt-2",
            payload: {
                ...makeEnvelope().payload,
                actionItemId: "ai-2",
                idempotencyKey: "ai-2:push",
            },
        });

        expect(telegramCalls(apis, "getUpdates")).toHaveLength(0);
        expect(telegramCalls(apis, "sendMessage")).toHaveLength(2);
        expect(
            apis.request.mock.calls.every(
                ([url]) => !url.includes("getUpdates"),
            ),
        ).toBe(true);
    });

    it("không có TELEGRAM_CHAT_ID thì dò chat gần nhất bằng getUpdates và lưu lại", async () => {
        const { apis, integrations, service } = setup(
            fullConfig({ telegram: { chatId: undefined } }),
        );
        apis.telegramUpdates = [
            { update_id: 1, message: { chat: { id: 111 } } },
            { update_id: 2, message: { chat: { id: 222 } } },
            { update_id: 3, poll: {} },
        ];

        const res = await service.handle(makeEnvelope());

        expect(res.results[1]).toMatchObject({
            provider: "telegram",
            status: "synced",
        });
        expect(apis.sentMessages[0].chat_id).toBe("222");
        expect(
            integrations.rows.find((r) => r.provider === "telegram").config,
        ).toEqual({ chatId: "222", chatIdSource: "getUpdates" });

        // Lần sau dùng chat đã lưu, không dò lại.
        apis.telegramUpdates = [];
        await service.handle({
            ...makeEnvelope(),
            eventId: "evt-2",
            payload: {
                ...makeEnvelope().payload,
                actionItemId: "ai-2",
                idempotencyKey: "ai-2:push",
            },
        });
        expect(apis.sentMessages[1].chat_id).toBe("222");
        const getUpdates = telegramCalls(apis, "getUpdates");
        expect(getUpdates).toHaveLength(1);
        // Không offset: không xác nhận (xoá) update của ứng dụng khác dùng chung bot.
        expect(getUpdates[0][1].query).not.toHaveProperty("offset");
    });

    it("Telegram từ chối (chưa bấm Start, sai chat) thì failed kèm mô tả của API, không ném lỗi để requeue", async () => {
        const { apis, jobs, service } = setup(fullConfig());
        apis.request.mockImplementation(async (url: string) => {
            if (url.includes("api.telegram.org")) {
                return {
                    status: 403,
                    ok: false,
                    data: {
                        ok: false,
                        error_code: 403,
                        description:
                            "Forbidden: bot can't initiate conversation with a user",
                    },
                };
            }
            return ok([]);
        });

        // Không ném: tin được ack, không quay vòng retry.
        const res = await service.handle(makeEnvelope());

        expect(res.results[1]).toEqual({
            provider: "telegram",
            status: "failed",
            error: "Telegram trả lỗi 403 (sendMessage): Forbidden: bot can't initiate conversation with a user",
        });
        expect(telegramCalls(apis, "sendMessage")).toHaveLength(1);
        expect(telegramCalls(apis, "getUpdates")).toHaveLength(0);
        expect(
            jobs.rows.find((j) => j.idempotencyKey === "ai-1:push:telegram"),
        ).toMatchObject({
            status: SyncJobStatus.FAILED,
        });
    });

    it("chưa ai nhắn cho bot thì telegram failed kèm hướng dẫn", async () => {
        const { apis, service } = setup(
            fullConfig({ telegram: { chatId: undefined } }),
        );
        apis.telegramUpdates = [];

        const res = await service.handle(makeEnvelope());

        expect(res.results[1]).toEqual({
            provider: "telegram",
            status: "failed",
            error: "Hãy nhắn một tin cho bot trước",
        });
        expect(apis.sentMessages).toHaveLength(0);
    });

    it("chỉ có TRELLO_BOARD_ID thì tạo list mặc định trên board, một lần", async () => {
        const { apis, integrations, service } = setup(
            fullConfig({ trello: { listId: undefined, boardId: BOARD_ID } }),
        );

        await service.handle(makeEnvelope());
        await service.handle({
            ...makeEnvelope(),
            eventId: "evt-2",
            payload: {
                ...makeEnvelope().payload,
                actionItemId: "ai-2",
                idempotencyKey: "ai-2:push",
            },
        });

        expect(apis.createdLists).toEqual([
            { name: DEFAULT_TRELLO_LIST_NAME, idBoard: BOARD_ID, pos: "top" },
        ]);
        expect(apis.createdCards.map((c) => c.idList)).toEqual([
            LIST_ID,
            LIST_ID,
        ]);
        expect(
            trelloCalls(apis, "GET", `/boards/${BOARD_ID}/lists`),
        ).toHaveLength(1);
        expect(
            integrations.rows.find((r) => r.provider === "trello").config,
        ).toMatchObject({ boardId: BOARD_ID, resolvedListId: LIST_ID });
    });

    it("có key+token nhưng thiếu list và board thì trello failed, nêu rõ cách sửa", async () => {
        const { apis, integrations, service } = setup(
            fullConfig({ trello: { listId: undefined, boardId: undefined } }),
        );

        const res = await service.handle(makeEnvelope());

        expect(res.results[0].status).toBe("failed");
        expect(res.results[0].error).toContain("TRELLO_LIST_ID");
        expect(res.results[0].error).toContain("TRELLO_BOARD_ID");
        expect(res.results[1].status).toBe("synced");
        expect(trelloCalls(apis, "POST", "/cards")).toHaveLength(0);
        expect(
            integrations.rows.find((r) => r.provider === "trello"),
        ).toMatchObject({
            status: "error",
            lastError: expect.stringContaining("TRELLO_LIST_ID"),
        });
    });

    it("dòng integrations không chứa bí mật", async () => {
        const { integrations, registry } = setup(fullConfig());

        await registry.syncFromEnv();

        expect(integrations.rows).toHaveLength(2);
        const stored = JSON.stringify(integrations.rows);
        for (const secret of SECRETS) {
            expect(stored).not.toContain(secret);
        }
        expect(integrations.rows[0]).toMatchObject({
            workspaceId: "*",
            externalAccountId: "env",
            provider: "trello",
            config: { listId: LIST_ID },
        });
    });
});

describe("HttpClient", () => {
    const realFetch = global.fetch;
    afterEach(() => {
        global.fetch = realFetch;
    });

    it("lỗi mạng chỉ nêu host, không lộ đường dẫn hay query", async () => {
        global.fetch = jest.fn().mockRejectedValue(
            Object.assign(new TypeError("fetch failed"), {
                cause: { code: "ECONNREFUSED" },
            }),
        );
        const http = new HttpClient();

        const err = await http
            .request(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                query: { key: TRELLO_KEY },
            })
            .catch((e) => e);

        expect(err.message).toBe(
            "Không gọi được api.telegram.org: ECONNREFUSED",
        );
    });

    it("đọc JSON khi được, giữ chuỗi thô khi không", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce(new Response('{"a":1}', { status: 200 }))
            .mockResolvedValueOnce(
                new Response("invalid key", { status: 401 }),
            );
        const http = new HttpClient();

        await expect(
            http.request("https://api.trello.com/1/x"),
        ).resolves.toEqual({
            status: 200,
            ok: true,
            data: { a: 1 },
        });
        await expect(
            http.request("https://api.trello.com/1/x"),
        ).resolves.toEqual({
            status: 401,
            ok: false,
            data: "invalid key",
        });
    });
});
