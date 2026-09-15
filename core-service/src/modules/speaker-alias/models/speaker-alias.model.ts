import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { SpeakerAlias } from "../entities/speaker-alias.entity";

@Table({
    tableName: "speaker_aliases",
    timestamps: true,
    indexes: [
        { fields: ["transcriptVersionId", "speakerLabel"], unique: true },
    ],
})
export class SpeakerAliasModel extends Model implements SpeakerAlias {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    transcriptVersionId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    speakerLabel: string;

    @Column({ type: DataType.STRING, allowNull: false })
    displayName: string;

    @Column({ type: DataType.STRING, allowNull: true })
    userId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    confirmedById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    confirmedAt?: Date;
}
