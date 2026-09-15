import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ActionItemCitation } from "../entities/action-item-citation.entity";
import { CitationSourceType } from "../common/constant";

@Table({
    tableName: "action_item_citations",
    timestamps: true,
    indexes: [
        { fields: ["actionItemId"] },
        { fields: ["meetingId", "startMs"] },
    ],
})
export class ActionItemCitationModel extends Model implements ActionItemCitation {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    actionItemId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    sourceType: CitationSourceType;

    @Column({ type: DataType.STRING, allowNull: true })
    transcriptSegmentId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    transcriptVersionId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    noteId?: string;

    @Column({ type: DataType.INTEGER, allowNull: true })
    startMs?: number;

    @Column({ type: DataType.INTEGER, allowNull: true })
    endMs?: number;

    @Column({ type: DataType.TEXT, allowNull: false })
    quote: string;
}
