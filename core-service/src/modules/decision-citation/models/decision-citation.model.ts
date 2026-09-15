import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { DecisionCitation } from "../entities/decision-citation.entity";

@Table({
    tableName: "decision_citations",
    timestamps: true,
    indexes: [
        { fields: ["decisionId"] },
    ],
})
export class DecisionCitationModel extends Model implements DecisionCitation {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    decisionId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    transcriptSegmentId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    noteId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    transcriptVersionId?: string;

    @Column({ type: DataType.INTEGER, allowNull: true })
    startMs?: number;

    @Column({ type: DataType.INTEGER, allowNull: true })
    endMs?: number;

    @Column({ type: DataType.TEXT, allowNull: false })
    quote: string;
}
