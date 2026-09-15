import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Note } from "../entities/note.entity";
import { NoteType, NoteVisibility } from "../common/constant";

@Table({
    tableName: "notes",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["meetingId", "recordingMs"] },
        { fields: ["workspaceId", "authorId"] },
        { fields: ["meetingId", "visibility"] },
    ],
})
export class NoteModel extends Model implements Note {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    agendaItemId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    authorId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    type: NoteType;

    @Column({ type: DataType.STRING, allowNull: false })
    visibility: NoteVisibility;

    @Column({ type: DataType.DATE, allowNull: true })
    sharedAt?: Date;

    @Column({ type: DataType.TEXT, allowNull: false })
    body: string;

    @Column({ type: DataType.JSONB, allowNull: true })
    checklist?: Record<string, any>[];

    @Column({ type: DataType.JSONB, allowNull: true })
    tags?: Record<string, any>[];

    @Column({ type: DataType.INTEGER, allowNull: true })
    recordingMs?: number;

    @Column({ type: DataType.STRING, allowNull: true })
    transcriptSegmentId?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
