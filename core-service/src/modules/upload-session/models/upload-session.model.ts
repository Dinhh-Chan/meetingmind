import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { UploadSession } from "../entities/upload-session.entity";
import { UploadSessionStatus } from "../common/constant";

@Table({
    tableName: "upload_sessions",
    timestamps: true,
    indexes: [
        { fields: ["workspaceId", "clientRecordingId"], unique: true },
    ],
})
export class UploadSessionModel extends Model implements UploadSession {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    fileId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    uploadId: string;

    @Column({ type: DataType.INTEGER, allowNull: true })
    totalParts?: number;

    @Column({ type: DataType.JSONB, allowNull: false })
    completedParts: Record<string, any>[];

    @Column({ type: DataType.STRING, allowNull: false })
    clientRecordingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: UploadSessionStatus;

    @Column({ type: DataType.DATE, allowNull: false })
    expiresAt: Date;
}
