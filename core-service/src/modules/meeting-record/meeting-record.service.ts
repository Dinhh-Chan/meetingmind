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
 * - người ghi xem (và sửa, gửi duyệt) bản của mình;
 * - người duyệt (PM, Owner/Admin) xem mọi bản;
 * - người khác chỉ xem transcript của thư ký, không xem biên bản nháp nào.
 * Biên bản được duyệt thì mọi người xem cuộc họp đều thấy nó và transcript
 * nguồn của nó; các bản khác không gửi duyệt được nữa.
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

        // Mỗi người ghi một transcript đang dùng, cộng transcript nguồn của bản đã duyệt.
        const byRecorder = new Map<string, TranscriptVersion>();
        for (const t of transcripts) {
            const key = MeetingRecordService.recorderOf(t, meeting) ?? "";
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

        const records: MeetingRecord[] = [];
        for (const transcript of candidates) {
            const recordedById = MeetingRecordService.recorderOf(transcript, meeting);
            const mine = !!recordedById && recordedById === userId;
            const official = transcript._id === officialSource;
            const isDesignated = !!recordedById && designated.has(recordedById);
            if (!(seeAll || mine || isDesignated || official)) continue;

            // Người ngoài chỉ thấy biên bản đã duyệt; người ghi và người duyệt
            // thấy bản mới nhất (kể cả nháp).
            const latest = latestOf.get(transcript._id) ?? null;
            const minutes =
                seeAll || mine ? latest : official ? approved : null;
            records.push({
                transcript,
                recordedById,
                minutes,
                designated: isDesignated,
                official,
                mine,
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
     * Transcript ai xem cuộc họp cũng thấy: của thư ký, hoặc nguồn của biên bản
     * đã duyệt. Chỉ những bản này vào kho hỏi đáp.
     */
    async isPublicTranscript(
        meeting: { _id: string; createdById?: string | null },
        transcript: Pick<TranscriptVersion, "_id" | "recordedById">,
    ) {
        const recorder = MeetingRecordService.recorderOf(transcript, meeting);
        if (recorder) {
            const secretary = await this.meetingParticipantService.getOne(null, {
                meetingId: meeting._id,
                userId: recorder,
                role: MeetingParticipantRole.SECRETARY,
            });
            if (secretary) return true;
        }
        const row = await this.meetingMinutesService.getOne(null, {
            meetingId: meeting._id,
        });
        if (!row?.approvedVersionId) return false;
        const approved = await this.minutesVersionService.getById(
            null,
            row.approvedVersionId,
        );
        return approved?.sourceTranscriptVersionId === transcript._id;
    }
}
