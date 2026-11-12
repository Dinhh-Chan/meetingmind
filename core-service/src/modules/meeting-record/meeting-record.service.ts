import { MeetingMinutesService } from "@module/meeting-minutes/services/meeting-minutes.service";
import { MeetingParticipantRole } from "@module/meeting-participant/common/constant";
import { MeetingParticipantService } from "@module/meeting-participant/services/meeting-participant.service";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import { MinutesVersionStatus } from "@module/minutes-version/common/constant";
import { MinutesVersion } from "@module/minutes-version/entities/minutes-version.entity";
import { MinutesVersionService } from "@module/minutes-version/services/minutes-version.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { TranscriptVersion } from "@module/transcript-version/entities/transcript-version.entity";
import { TranscriptVersionService } from "@module/transcript-version/services/transcript-version.service";
import { Injectable } from "@nestjs/common";

export type MeetingRef = Pick<
    Meeting,
    "_id" | "workspaceId" | "projectId" | "createdById"
>;

/** Một bản ghi: transcript đang dùng của một người ghi âm và biên bản sinh từ nó. */
export interface MeetingRecord {
    transcript: TranscriptVersion;
    recordedById: string | null;
    /** Biên bản người xem thấy được của bản ghi này (nháp mới nhất hoặc bản đã duyệt). */
    minutes: MinutesVersion | null;
    /** Người ghi là thư ký — người được chỉ định ghi âm của cuộc họp. */
    designated: boolean;
    /** Lần ghi âm thứ mấy của người ghi này trong cuộc họp (từ 1). */
    recordingNo: number;
    /** Transcript nguồn của biên bản đã duyệt. */
    official: boolean;
    mine: boolean;
}

export interface MeetingRecords {
    /** Người duyệt: xem bản nháp của mọi người ghi. */
    seeAll: boolean;
    approved: MinutesVersion | null;
    /** Các bản ghi người này xem được, bản nên mở trước đứng đầu. */
    records: MeetingRecord[];
}

const createdAtOf = (row: object) => {
    const at = (row as { createdAt?: Date | string }).createdAt;
    return at ? new Date(at).getTime() : 0;
};

/**
 * Ai xem được bản ghi nào của một cuộc họp.
 *
 * Ai có quyền ghi âm cũng ghi được; mỗi lần ghi cho ra transcript và biên bản
 * nháp của riêng người ghi. Trước khi duyệt:
 * - người ghi xem (và sửa, gửi duyệt) bản của mình — chỉ mình xem;
 * - người duyệt (PM, Owner/Admin) xem bản đã được gửi duyệt;
 * - người khác không xem bản nào.
 * Biên bản được duyệt thì mọi người xem cuộc họp đều thấy nó và transcript
 * nguồn của nó, cùng transcript của thư ký; các bản khác không gửi duyệt được nữa.
 */
@Injectable()
export class MeetingRecordService {
    constructor(
        private readonly permissionService: PermissionService,
        private readonly transcriptVersionService: TranscriptVersionService,
        private readonly meetingMinutesService: MeetingMinutesService,
        private readonly minutesVersionService: MinutesVersionService,
        private readonly meetingParticipantService: MeetingParticipantService,
    ) {}

    /** Người ghi của một transcript; bản cũ chưa ghi người thì là người tạo cuộc họp. */
    static recorderOf(
        transcript: Pick<TranscriptVersion, "recordedById">,
        meeting: { createdById?: string | null },
    ): string | null {
        return transcript.recordedById ?? meeting.createdById ?? null;
    }

    /** Bản ghi người này xem được ở từng cuộc họp (đã kiểm tra quyền xem cuộc họp từ trước). */
    async recordsFor(
        userId: string,
        meetings: MeetingRef[],
    ): Promise<Map<string, MeetingRecords>> {
        const result = new Map<string, MeetingRecords>();
        if (!meetings.length) return result;
        const ids = meetings.map((m) => m._id);

        const [transcripts, minutesRows, secretaries, seeAllMeetings] =
            await Promise.all([
                this.transcriptVersionService.getMany(null, {
                    meetingId: { $in: ids },
                }),
                this.meetingMinutesService.getMany(null, {
                    meetingId: { $in: ids },
                }),
                this.meetingParticipantService.getMany(null, {
                    meetingId: { $in: ids },
                    role: MeetingParticipantRole.SECRETARY,
                }),
                this.permissionService.filterMeetings(userId, meetings, [
                    Permission.MINUTES_VIEW_DRAFT,
                ]),
            ]);
        const versions = minutesRows.length
            ? await this.minutesVersionService.getMany(null, {
                  meetingMinutesId: { $in: minutesRows.map((m) => m._id) },
              })
            : [];
        const seeAllIds = new Set(seeAllMeetings.map((m) => m._id));

        for (const meeting of meetings) {
            const row = minutesRows.find((m) => m.meetingId === meeting._id);
            result.set(
                meeting._id,
                this.compute(userId, meeting, {
                    seeAll: seeAllIds.has(meeting._id),
                    transcripts: transcripts.filter(
                        (t) => t.meetingId === meeting._id,
                    ),
                    versions: row
                        ? versions.filter((v) => v.meetingMinutesId === row._id)
                        : [],
                    approvedVersionId: row?.approvedVersionId,
                    designated: new Set(
                        secretaries
                            .filter((p) => p.meetingId === meeting._id)
                            .map((p) => p.userId)
                            .filter(Boolean),
                    ),
                }),
            );
        }
        return result;
    }

    async recordsOf(userId: string, meeting: MeetingRef) {
        return (await this.recordsFor(userId, [meeting])).get(meeting._id);
    }

    private compute(
        userId: string,
        meeting: MeetingRef,
        input: {
            seeAll: boolean;
            transcripts: TranscriptVersion[];
            versions: MinutesVersion[];
            approvedVersionId?: string;
            designated: Set<string>;
        },
    ): MeetingRecords {
        const { seeAll, transcripts, versions, designated } = input;
        const approvedList = versions.filter(
            (v) => v.status === MinutesVersionStatus.APPROVED,
        );
        const approved =
            approvedList.find((v) => v._id === input.approvedVersionId) ??
            approvedList.sort((a, b) => b.versionNo - a.versionNo)[0] ??
            null;

        // Biên bản mới nhất của từng transcript (chạy lại AI tạo phiên bản mới).
        const latestOf = new Map<string, MinutesVersion>();
        for (const v of versions) {
            if (!v.sourceTranscriptVersionId) continue;
            const prev = latestOf.get(v.sourceTranscriptVersionId);
            if (!prev || v.versionNo > prev.versionNo) {
                latestOf.set(v.sourceTranscriptVersionId, v);
            }
        }

        // Mỗi lần ghi âm của mỗi người một transcript đang dùng (bản cũ chưa ghi
        // tệp nguồn thì gộp theo người ghi), cộng transcript nguồn của bản đã duyệt.
        const byRecorder = new Map<string, TranscriptVersion>();
        for (const t of transcripts) {
            const key = `${MeetingRecordService.recorderOf(t, meeting) ?? ""}|${t.recordingKey ?? ""}`;
            const prev = byRecorder.get(key);
            const better =
                !prev ||
                (t.isCurrent && !prev.isCurrent) ||
                (t.isCurrent === prev.isCurrent && t.versionNo > prev.versionNo);
            if (better) byRecorder.set(key, t);
        }
        const candidates = [...byRecorder.values()];
        const officialSource = approved?.sourceTranscriptVersionId;
        if (officialSource && !candidates.some((t) => t._id === officialSource)) {
            const source = transcripts.find((t) => t._id === officialSource);
            if (source) candidates.push(source);
        }

        // Thứ tự lần ghi của từng người ("Bản ghi 2, 3…"), tính trên mọi bản của người đó.
        const recordingNo = new Map<string, number>();
        const seen = new Map<string, number>();
        for (const t of [...candidates].sort((a, b) => createdAtOf(a) - createdAtOf(b))) {
            const who = MeetingRecordService.recorderOf(t, meeting) ?? "";
            seen.set(who, (seen.get(who) ?? 0) + 1);
            recordingNo.set(t._id, seen.get(who));
        }

        const records: MeetingRecord[] = [];
        for (const transcript of candidates) {
            const recordedById = MeetingRecordService.recorderOf(transcript, meeting);
            const mine = !!recordedById && recordedById === userId;
            const official = transcript._id === officialSource;
            const isDesignated = !!recordedById && designated.has(recordedById);
            const latest = latestOf.get(transcript._id) ?? null;
            // Người duyệt chỉ thấy bản người ghi đã gửi duyệt (hoặc đã duyệt).
            const submitted =
                latest?.status === MinutesVersionStatus.PENDING_APPROVAL ||
                latest?.status === MinutesVersionStatus.APPROVED;
            // Transcript của thư ký công khai sau khi cuộc họp có biên bản được duyệt.
            const designatedPublic = isDesignated && !!approved;
            if (!(mine || official || designatedPublic || (seeAll && submitted))) continue;

            // Người ngoài chỉ thấy biên bản đã duyệt; người ghi và người duyệt
            // thấy bản mới nhất (kể cả nháp của chính mình).
            const minutes =
                mine || (seeAll && submitted) ? latest : official ? approved : null;
            records.push({
                transcript,
                recordedById,
                minutes,
                designated: isDesignated,
                official,
                mine,
                recordingNo: recordingNo.get(transcript._id) ?? 1,
            });
        }

        const rank = (r: MeetingRecord) =>
            r.official
                ? 0
                : seeAll && r.minutes?.status === MinutesVersionStatus.PENDING_APPROVAL
                  ? 1
                  : r.mine
                    ? 2
                    : r.designated
                      ? 3
                      : 4;
        records.sort(
            (a, b) =>
                rank(a) - rank(b) ||
                createdAtOf(b.transcript) - createdAtOf(a.transcript),
        );
        return { seeAll, approved, records };
    }

    /** Trạng thái biên bản người này thấy ở danh sách: của bản ghi nên mở trước. */
    static minutesStatusOf(records: MeetingRecords | undefined) {
        if (!records) return undefined;
        if (records.approved) return MinutesVersionStatus.APPROVED;
        return records.records.find((r) => r.minutes)?.minutes?.status;
    }

    /**
     * Transcript ai xem cuộc họp cũng thấy (chỉ sau khi có biên bản được
     * duyệt): nguồn của biên bản đã duyệt, hoặc của thư ký. Chỉ những bản này
     * vào kho hỏi đáp.
     */
    async isPublicTranscript(
        meeting: { _id: string; createdById?: string | null },
        transcript: Pick<TranscriptVersion, "_id" | "recordedById">,
    ) {
        const row = await this.meetingMinutesService.getOne(null, {
            meetingId: meeting._id,
        });
        if (!row?.approvedVersionId) return false;
        const approved = await this.minutesVersionService.getById(
            null,
            row.approvedVersionId,
        );
        if (approved?.sourceTranscriptVersionId === transcript._id) return true;
        const recorder = MeetingRecordService.recorderOf(transcript, meeting);
        if (!recorder) return false;
        const secretary = await this.meetingParticipantService.getOne(null, {
            meetingId: meeting._id,
            userId: recorder,
            role: MeetingParticipantRole.SECRETARY,
        });
        return !!secretary;
    }
}
