import { MeetingParticipantRole } from "@module/meeting-participant/common/constant";
import { MinutesVersionStatus } from "@module/minutes-version/common/constant";
import { MeetingRecordService } from "./meeting-record.service";

// p-limit là ESM, jest (CommonJS) không nạp được; service này không dùng tới.
jest.mock("p-limit", () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));

/**
 * Quy tắc xem bản ghi (QA: phân quyền ghi âm, xem biên bản):
 * bản ghi chỉ người ghi xem; người duyệt xem bản đã gửi duyệt; duyệt xong thì
 * ai cũng xem bản đã duyệt và transcript của thư ký.
 */
describe("MeetingRecordService", () => {
    const meeting = { _id: "m1", workspaceId: "w1", projectId: "p1", createdById: "creator" };

    const transcript = (
        id: string,
        recordedById: string | undefined,
        versionNo: number,
        isCurrent = true,
        recordingKey?: string,
    ) => ({
        _id: id,
        meetingId: "m1",
        recordedById,
        recordingKey,
        versionNo,
        isCurrent,
        createdAt: new Date(2026, 10, 10, 9, versionNo),
    });
    const minutes = (id: string, source: string, status: MinutesVersionStatus, versionNo: number) => ({
        _id: id,
        meetingMinutesId: "mm1",
        sourceTranscriptVersionId: source,
        status,
        versionNo,
    });

    function setup(input: {
        transcripts: ReturnType<typeof transcript>[];
        versions?: ReturnType<typeof minutes>[];
        approvedVersionId?: string;
        secretaries?: string[];
        approvers?: string[];
    }) {
        const service = new MeetingRecordService(
            {
                filterMeetings: async (userId: string, list: unknown[]) =>
                    (input.approvers ?? []).includes(userId) ? list : [],
            } as any,
            { getMany: async () => input.transcripts } as any,
            {
                getMany: async () => [{ _id: "mm1", meetingId: "m1", approvedVersionId: input.approvedVersionId }],
            } as any,
            { getMany: async () => input.versions ?? [] } as any,
            {
                getMany: async () =>
                    (input.secretaries ?? []).map((userId) => ({
                        meetingId: "m1",
                        userId,
                        role: MeetingParticipantRole.SECRETARY,
                    })),
            } as any,
        );
        return (userId: string) => service.recordsOf(userId, meeting as any);
    }

    const ids = (view: Awaited<ReturnType<ReturnType<typeof setup>>>) => view.records.map((r) => r.transcript._id);

    it("thành viên không ghi âm không xem bản nháp của người khác", async () => {
        const recordsOf = setup({
            transcripts: [transcript("tA", "alice", 1)],
            versions: [minutes("vA", "tA", MinutesVersionStatus.DRAFT, 1)],
        });
        const view = await recordsOf("bob");
        expect(view.records).toEqual([]);
        expect(MeetingRecordService.minutesStatusOf(view)).toBeUndefined();
    });

    it("mỗi lần ghi âm là một bản ghi riêng, xử lý lại cùng tệp thì chỉ lấy bản đang dùng", async () => {
        const recordsOf = setup({
            transcripts: [
                transcript("t1", "alice", 1, false, "a.webm"),
                transcript("t2", "alice", 2, true, "a.webm"),
                transcript("t3", "alice", 3, true, "b.webm"),
            ],
        });
        const view = await recordsOf("alice");
        // Mới nhất đứng trước; đánh số theo thứ tự ghi.
        expect(view.records.map((r) => [r.transcript._id, r.recordingNo])).toEqual([
            ["t3", 2],
            ["t2", 1],
        ]);
    });

    it("người ghi chỉ xem bản của mình, kèm biên bản nháp", async () => {
        const recordsOf = setup({
            transcripts: [transcript("tA", "alice", 1), transcript("tB", "bob", 2)],
            versions: [
                minutes("vA", "tA", MinutesVersionStatus.DRAFT, 1),
                minutes("vB", "tB", MinutesVersionStatus.PENDING_APPROVAL, 2),
            ],
        });
        const view = await recordsOf("alice");
        expect(ids(view)).toEqual(["tA"]);
        expect(view.records[0].mine).toBe(true);
        expect(view.records[0].minutes?._id).toBe("vA");
        expect(MeetingRecordService.minutesStatusOf(view)).toBe(MinutesVersionStatus.DRAFT);
    });

    it("transcript của thư ký chỉ hiện cho mọi người sau khi PM duyệt", async () => {
        const before = setup({
            transcripts: [transcript("tS", "sec", 1)],
            versions: [minutes("vS", "tS", MinutesVersionStatus.PENDING_APPROVAL, 1)],
            secretaries: ["sec"],
        });
        expect((await before("bob")).records).toEqual([]);

        const after = setup({
            transcripts: [transcript("tA", "alice", 1), transcript("tS", "sec", 2)],
            versions: [
                minutes("vA", "tA", MinutesVersionStatus.APPROVED, 1),
                minutes("vS", "tS", MinutesVersionStatus.DRAFT, 2),
            ],
            approvedVersionId: "vA",
            secretaries: ["sec"],
        });
        const view = await after("bob");
        expect(ids(view)).toEqual(["tA", "tS"]);
        expect(view.records[1].designated).toBe(true);
        expect(view.records[1].minutes).toBeNull();
    });

    it("người duyệt chỉ xem bản đã gửi duyệt, không xem nháp của người khác", async () => {
        const recordsOf = setup({
            transcripts: [transcript("tA", "alice", 1), transcript("tB", "bob", 2)],
            versions: [
                minutes("vA", "tA", MinutesVersionStatus.PENDING_APPROVAL, 1),
                minutes("vB", "tB", MinutesVersionStatus.DRAFT, 2),
            ],
            approvers: ["pm"],
        });
        const view = await recordsOf("pm");
        expect(view.seeAll).toBe(true);
        expect(ids(view)).toEqual(["tA"]);
        expect(MeetingRecordService.minutesStatusOf(view)).toBe(MinutesVersionStatus.PENDING_APPROVAL);
    });

    it("duyệt xong: mọi người xem bản đã duyệt; người ghi khác vẫn thấy bản mình", async () => {
        const recordsOf = setup({
            transcripts: [transcript("tA", "alice", 1), transcript("tB", "bob", 2)],
            versions: [
                minutes("vA", "tA", MinutesVersionStatus.APPROVED, 1),
                minutes("vB", "tB", MinutesVersionStatus.DRAFT, 2),
            ],
            approvedVersionId: "vA",
        });
        const outsider = await recordsOf("carol");
        expect(ids(outsider)).toEqual(["tA"]);
        expect(outsider.records[0].official).toBe(true);
        expect(outsider.records[0].minutes?._id).toBe("vA");

        const bob = await recordsOf("bob");
        expect(ids(bob)).toEqual(["tA", "tB"]);
        expect(bob.approved?._id).toBe("vA");
        expect(MeetingRecordService.minutesStatusOf(bob)).toBe(MinutesVersionStatus.APPROVED);
    });

    it("mỗi người ghi một bản đang dùng; bản cũ chưa ghi người là của người tạo cuộc họp", async () => {
        const recordsOf = setup({
            transcripts: [
                transcript("old", undefined, 1, false),
                transcript("tC", "creator", 2),
                transcript("tA1", "alice", 3, false),
                transcript("tA2", "alice", 4),
            ],
        });
        expect(ids(await recordsOf("alice"))).toEqual(["tA2"]);
        expect(ids(await recordsOf("creator"))).toEqual(["tC"]);
        expect(MeetingRecordService.recorderOf({ recordedById: undefined }, meeting)).toBe("creator");
    });
});
