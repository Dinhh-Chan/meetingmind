import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MeetingParticipant } from "../entities/meeting-participant.entity";
import { MeetingParticipantRole } from "../common/constant";

@Table({
    tableName: "meeting_participants",
    timestamps: true,
    indexes: [
        { fields: ["meetingId"] },
        { fields: ["workspaceId", "userId"] },
    ],
})
export class MeetingParticipantModel extends Model implements MeetingParticipant {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    userId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    displayName: string;

    @Column({ type: DataType.STRING, allowNull: true })
    email?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    role?: MeetingParticipantRole;
}
