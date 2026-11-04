import { UniqueConstraintError } from "sequelize";
import { MessageDedupService } from "./message-dedup.service";

// Chỉ cần token DI; tránh kéo BaseService (phụ thuộc ESM) vào Jest.
jest.mock(
    "@module/processed-message/services/processed-message.service",
    () => ({
        ProcessedMessageService: class {},
    }),
);

describe("MessageDedupService", () => {
    const make = (create: jest.Mock) =>
        new MessageDedupService({ create, deleteOne: jest.fn() } as any);

    it("lần đầu thấy message thì nhận xử lý", async () => {
        const create = jest.fn().mockResolvedValue({});
        await expect(make(create).claim("evt-1", "c")).resolves.toBe(true);
        expect(create).toHaveBeenCalledWith(
            null,
            expect.objectContaining({ messageId: "evt-1", consumer: "c" }),
        );
    });

    it("trùng (messageId, consumer) thì bỏ qua", async () => {
        const create = jest
            .fn()
            .mockRejectedValue(new UniqueConstraintError({ message: "dup" }));
        await expect(make(create).claim("evt-1", "c")).resolves.toBe(false);
    });

    it("lỗi DB khác thì ném ra để tin được giao lại, không coi là trùng", async () => {
        const create = jest
            .fn()
            .mockRejectedValue(new Error("connection refused"));
        await expect(make(create).claim("evt-1", "c")).rejects.toThrow(
            "connection refused",
        );
    });
});
