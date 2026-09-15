import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { RiskFlag } from "../entities/risk-flag.entity";
import { RiskSeverity, RiskStatus, RiskType } from "../common/constant";

@Table({
    tableName: "risk_flags",
    timestamps: true,
    indexes: [
        { fields: ["workspaceId", "dedupKey"], unique: true },
        { fields: ["workspaceId", "status"] },
        { fields: ["workspaceId", "severity"] },
        { fields: ["workspaceId", "userId"] },
    ],
})
export class RiskFlagModel extends Model implements RiskFlag {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    projectId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    meetingId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    userId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    actionItemId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    type: RiskType;

    @Column({ type: DataType.STRING, allowNull: false })
    severity: RiskSeverity;

    @Column({ type: DataType.STRING, allowNull: false })
    title: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    description?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    ruleKey: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    evidence: Record<string, any>;

    @Column({ type: DataType.STRING, allowNull: false })
    dedupKey: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: RiskStatus;

    @Column({ type: DataType.DATE, allowNull: false })
    detectedAt: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    resolvedAt?: Date;
}
