import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";

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

    @Column({ type: DataType.STRING, allowNull: true })
    currentVersionId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    approvedVersionId?: string;
}
