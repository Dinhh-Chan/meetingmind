import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { RecordingSegment } from "../entities/recording-segment.entity";
import { RecordingGapReason } from "../common/constant";

@Table({
    tableName: "recording_segments",
    timestamps: true,
    indexes: [
        { fields: ["meetingId", "sequence"], unique: true },
    ],
})
export class RecordingSegmentModel extends Model implements RecordingSegment {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    fileId: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    sequence: number;

    @Column({ type: DataType.INTEGER, allowNull: false })
    startOffsetMs: number;

    @Column({ type: DataType.INTEGER, allowNull: false })
    durationMs: number;

    @Column({ type: DataType.BOOLEAN, allowNull: false })
    hasGapBefore: boolean;

    @Column({ type: DataType.STRING, allowNull: true })
    gapReason?: RecordingGapReason;
}
