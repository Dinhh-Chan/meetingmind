import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { TranscriptVersion } from "../entities/transcript-version.entity";
import { TranscriptVersionSource } from "../common/constant";

@Table({
    tableName: "transcript_versions",
    timestamps: true,
    indexes: [
        { fields: ["meetingId", "versionNo"], unique: true },
        { fields: ["meetingId", "isCurrent"] },
    ],
})
export class TranscriptVersionModel extends Model implements TranscriptVersion {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    versionNo: number;

    @Column({ type: DataType.STRING, allowNull: false })
    source: TranscriptVersionSource;

    @Column({ type: DataType.STRING, allowNull: true })
    aiRunId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    createdById?: string;

    @Column({ type: DataType.BOOLEAN, allowNull: false })
    isCurrent: boolean;
}
