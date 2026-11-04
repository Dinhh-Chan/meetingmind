import { Inject, Injectable } from "@nestjs/common";
import {
    TASK_SYNC_CONFIG,
    TaskSyncConfig,
    TrelloConfig,
} from "../common/config";
import { hasMarkerLine } from "../common/format";
import { ProviderError, shortDetail } from "../common/provider-error";
import { HttpClient, HttpRequestOptions } from "./http-client.service";

const TRELLO_API = "https://api.trello.com/1";

export interface TrelloCard {
    id: string;
    name: string;
    desc?: string;
    url?: string;
    shortUrl?: string;
}

interface TrelloList {
    id: string;
    name: string;
}

export interface CreateTrelloCardInput {
    listId: string;
    name: string;
    desc: string;
    due?: string;
}

/** Gọi Trello REST API. Key/token đi trên query string nên không bao giờ log URL. */
@Injectable()
export class TrelloClient {
    /** Giữ promise thay vì giá trị: hai tin đến cùng lúc không tạo hai list. */
    private listIdPromise?: Promise<string>;

    constructor(
        private readonly http: HttpClient,
        @Inject(TASK_SYNC_CONFIG) private readonly config: TaskSyncConfig,
    ) {}

    /**
     * List nhận thẻ: TRELLO_LIST_ID nếu có, không thì tìm list theo tên trên
     * TRELLO_BOARD_ID, chưa có thì tạo.
     */
    resolveListId(): Promise<string> {
        const cfg = this.requireConfig();
        if (cfg.listId) {
            return Promise.resolve(cfg.listId);
        }
        if (!cfg.boardId) {
            return Promise.reject(
                new ProviderError(
                    "Chưa cấu hình TRELLO_LIST_ID hoặc TRELLO_BOARD_ID nên không biết đặt thẻ vào đâu",
                ),
            );
        }
        this.listIdPromise ??= this.findOrCreateList(cfg).catch((err) => {
            // Lỗi thì lần sau tra lại, không giữ promise hỏng.
            this.listIdPromise = undefined;
            throw err;
        });
        return this.listIdPromise;
    }

    /** Tìm thẻ đã tạo cho công việc này qua dòng đánh dấu trong mô tả. */
    async findCardByMarker(
        listId: string,
        marker: string,
    ): Promise<TrelloCard | null> {
        const cards = await this.call<TrelloCard[]>(`/lists/${listId}/cards`, {
            query: { fields: "name,desc,url,shortUrl" },
        });
        return (
            (cards ?? []).find((card) => hasMarkerLine(card.desc, marker)) ??
            null
        );
    }

    createCard(input: CreateTrelloCardInput): Promise<TrelloCard> {
        // Mô tả đi trong body JSON: có thể dài, không nên nhét vào URL.
        return this.call<TrelloCard>("/cards", {
            method: "POST",
            body: {
                idList: input.listId,
                name: input.name,
                desc: input.desc,
                pos: "top",
                ...(input.due ? { due: input.due } : {}),
            },
        });
    }

    private async findOrCreateList(cfg: TrelloConfig): Promise<string> {
        const lists = await this.call<TrelloList[]>(
            `/boards/${cfg.boardId}/lists`,
            { query: { filter: "open", fields: "name" } },
        );
        const found = (lists ?? []).find(
            (list) => list.name?.trim() === cfg.listName,
        );
        if (found) {
            return found.id;
        }
        const created = await this.call<TrelloList>("/lists", {
            method: "POST",
            body: { name: cfg.listName, idBoard: cfg.boardId, pos: "top" },
        });
        return created.id;
    }

    private async call<T>(
        path: string,
        options: HttpRequestOptions = {},
    ): Promise<T> {
        const cfg = this.requireConfig();
        const method = options.method ?? "GET";
        const res = await this.http.request<T>(`${TRELLO_API}${path}`, {
            ...options,
            method,
            query: { ...options.query, key: cfg.apiKey, token: cfg.token },
        });
        if (!res.ok) {
            throw new ProviderError(
                `Trello trả lỗi ${res.status} (${method} ${path}): ${shortDetail(res.data)}`,
            );
        }
        return res.data;
    }

    private requireConfig(): TrelloConfig {
        if (!this.config.trello) {
            throw new ProviderError("Chưa cấu hình Trello");
        }
        return this.config.trello;
    }
}
