import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { VoiceProfileStatus, VoiceQuality } from "../common/constant";
import { VoiceProfile } from "../entities/voice-profile.entity";

@Table({
    tableName: "voice_profiles",
    timestamps: true,
    indexes: [{ fields: ["userId"], unique: true }],
})
export class VoiceProfileModel extends Model implements VoiceProfile {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    userId: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    embedding: number[];

    @Column({ type: DataType.STRING, allowNull: false })
    model: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    sampleCount: number;

    @Column({ type: DataType.FLOAT, allowNull: false })
    seconds: number;

    @Column({ type: DataType.DATE, allowNull: false })
    consentAt: Date;

    @Column({ type: DataType.STRING, allowNull: true })
    status?: VoiceProfileStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    quality?: VoiceQuality;

    @Column({ type: DataType.JSONB, allowNull: true })
    sampleKeys?: string[];

    @Column({ type: DataType.STRING, allowNull: true })
    sampleMimetype?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    reviewedById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    reviewedAt?: Date;
}
