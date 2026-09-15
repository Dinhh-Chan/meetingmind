import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { TranscriptSegment } from "../entities/transcript-segment.entity";
import { SpeakerIdentityStatus } from "../common/constant";

@Table({
    tableName: "transcript_segments",
    timestamps: true,
    indexes: [
        { fields: ["transcriptVersionId", "sequence"], unique: true },
        { fields: ["meetingId", "startMs"] },
    ],
})
export class TranscriptSegmentModel extends Model implements TranscriptSegment {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    transcriptVersionId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    speakerLabel: string;

    @Column({ type: DataType.STRING, allowNull: true })
    speakerUserId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    identityStatus: SpeakerIdentityStatus;

    @Column({ type: DataType.INTEGER, allowNull: false })
    startMs: number;

    @Column({ type: DataType.INTEGER, allowNull: false })
    endMs: number;

    @Column({ type: DataType.TEXT, allowNull: false })
    text: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    rawText?: string;

    @Column({ type: DataType.FLOAT, allowNull: true })
    confidence?: number;

    @Column({ type: DataType.BOOLEAN, allowNull: true })
    isOverlapping?: boolean;

    @Column({ type: DataType.INTEGER, allowNull: false })
    sequence: number;
}
