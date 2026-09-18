import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MediaFile } from "../entities/media-file.entity";
import { MediaFileKind, MediaFileStatus } from "../common/constant";

@Table({
    tableName: "files",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["bucket", "objectKey"], unique: true },
        { fields: ["workspaceId", "meetingId"] },
    ],
})
export class MediaFileModel extends Model implements MediaFile {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    meetingId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    botSessionId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    kind: MediaFileKind;

    @Column({ type: DataType.STRING, allowNull: false })
    bucket: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    objectKey: string;

    @Column({ type: DataType.STRING, allowNull: false })
    mimetype: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    sizeBytes: number;

    @Column({ type: DataType.INTEGER, allowNull: true })
    durationMs?: number;

    @Column({ type: DataType.STRING, allowNull: true })
    checksum?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: MediaFileStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    uploadedById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
