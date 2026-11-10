import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ActivityType } from "../common/constant";
import { ActivityLog } from "../entities/activity-log.entity";

@Table({
    tableName: "activity_logs",
    timestamps: true,
    indexes: [{ fields: ["workspaceId", "createdAt"] }],
})
export class ActivityLogModel extends Model implements ActivityLog {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    actorId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    type: ActivityType;

    @Column({ type: DataType.TEXT, allowNull: false })
    target: string;

    @Column({ type: DataType.STRING, allowNull: true })
    meetingId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    projectId?: string;
}
