import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MeetingAccess } from "../entities/meeting-access.entity";
import { MeetingAccessRole } from "../common/constant";

@Table({
    tableName: "meeting_access",
    timestamps: true,
    indexes: [
        { fields: ["meetingId", "userId"], unique: true },
        { fields: ["workspaceId", "userId"] },
    ],
})
export class MeetingAccessModel extends Model implements MeetingAccess {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    userId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    role: MeetingAccessRole;

    @Column({ type: DataType.STRING, allowNull: true })
    grantedById?: string;
}
