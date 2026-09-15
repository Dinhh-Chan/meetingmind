import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";
import { MinutesStatus } from "../common/constant";

@Table({
    tableName: "meeting_minutes",
    timestamps: true,
    indexes: [
        { fields: ["meetingId"], unique: true },
    ],
})
export class MeetingMinutesModel extends Model implements MeetingMinutes {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    summary: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    decisions: Record<string, any>[];

    @Column({ type: DataType.JSONB, allowNull: false })
    openIssues: Record<string, any>[];

    @Column({ type: DataType.JSONB, allowNull: true })
    editorContent?: Record<string, any>;

    @Column({ type: DataType.STRING, allowNull: false })
    status: MinutesStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    approvedById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    approvedAt?: Date;
}
