import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Decision } from "../entities/decision.entity";
import { DecisionSource, DecisionStatus } from "../common/constant";

@Table({
    tableName: "decisions",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["workspaceId", "meetingId"] },
        { fields: ["workspaceId", "status"] },
    ],
})
export class DecisionModel extends Model implements Decision {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    agendaItemId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    title: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    description?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    decidedById?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: DecisionStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    supersededByDecisionId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    source: DecisionSource;

    @Column({ type: DataType.STRING, allowNull: true })
    reviewItemId?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
