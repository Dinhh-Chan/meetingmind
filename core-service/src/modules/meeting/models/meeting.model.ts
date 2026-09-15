import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Meeting } from "../entities/meeting.entity";
import { MeetingAccessScope, MeetingPlatform, MeetingSourceType, MeetingStatus, ProcessingStatus } from "../common/constant";

@Table({
    tableName: "meetings",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["workspaceId", "scheduledStartAt"] },
        { fields: ["workspaceId", "projectId"] },
        { fields: ["workspaceId", "status"] },
    ],
})
export class MeetingModel extends Model implements Meeting {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    projectId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    title: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    description?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    sourceType: MeetingSourceType;

    @Column({ type: DataType.TEXT, allowNull: true })
    meetingUrl?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    platform?: MeetingPlatform;

    @Column({ type: DataType.STRING, allowNull: false })
    language: string;

    @Column({ type: DataType.STRING, allowNull: false })
    accessScope: MeetingAccessScope;

    @Column({ type: DataType.STRING, allowNull: false })
    status: MeetingStatus;

    @Column({ type: DataType.DATE, allowNull: true })
    scheduledStartAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    scheduledEndAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    actualStartAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    actualEndAt?: Date;

    @Column({ type: DataType.STRING, allowNull: true })
    processingStatus?: ProcessingStatus;

    @Column({ type: DataType.STRING, allowNull: false })
    createdById: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
