import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MinutesVersion } from "../entities/minutes-version.entity";
import { MinutesVersionStatus } from "../common/constant";

@Table({
    tableName: "minutes_versions",
    timestamps: true,
    indexes: [
        { fields: ["meetingMinutesId", "versionNo"], unique: true },
    ],
})
export class MinutesVersionModel extends Model implements MinutesVersion {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingMinutesId: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    versionNo: number;

    @Column({ type: DataType.TEXT, allowNull: false })
    summary: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    openIssues: Record<string, any>[];

    @Column({ type: DataType.JSONB, allowNull: true })
    editorContent?: Record<string, any>;

    @Column({ type: DataType.STRING, allowNull: true })
    templateKey?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: MinutesVersionStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    sourceTranscriptVersionId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    aiRunId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    approvedById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    approvedAt?: Date;
}
