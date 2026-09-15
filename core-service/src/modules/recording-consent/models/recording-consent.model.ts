import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { RecordingConsent } from "../entities/recording-consent.entity";
import { ConsentMethod } from "../common/constant";

@Table({
    tableName: "recording_consents",
    timestamps: true,
    indexes: [
        { fields: ["meetingId"] },
    ],
})
export class RecordingConsentModel extends Model implements RecordingConsent {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    participantId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    method: ConsentMethod;

    @Column({ type: DataType.BOOLEAN, allowNull: false })
    granted: boolean;

    @Column({ type: DataType.DATE, allowNull: false })
    notifiedAt: Date;

    @Column({ type: DataType.JSONB, allowNull: true })
    evidence?: Record<string, any>;
}
