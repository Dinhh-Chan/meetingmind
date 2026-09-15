import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ActionItemHistory } from "../entities/action-item-history.entity";

@Table({
    tableName: "action_item_history",
    timestamps: true,
    updatedAt: false,
    indexes: [
        { fields: ["actionItemId"] },
    ],
})
export class ActionItemHistoryModel extends Model implements ActionItemHistory {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    actionItemId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    actorId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    field: string;

    @Column({ type: DataType.JSONB, allowNull: true })
    oldValue?: Record<string, any>;

    @Column({ type: DataType.JSONB, allowNull: true })
    newValue?: Record<string, any>;
}
