import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ActionItem } from "../entities/action-item.entity";
import { ActionItemPriority, ActionItemSource, ActionItemStatus } from "../common/constant";

@Table({
    tableName: "action_items",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["workspaceId", "status"] },
        { fields: ["workspaceId", "assigneeId"] },
        { fields: ["workspaceId", "deadline"] },
        { fields: ["workspaceId", "projectId"] },
        { fields: ["reviewItemId"], unique: true },
    ],
})
export class ActionItemModel extends Model implements ActionItem {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    projectId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    meetingId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    reviewItemId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    title: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    description?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    proposerId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    assigneeId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    approverId?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deadline?: Date;

    @Column({ type: DataType.STRING, allowNull: true })
    deadlineRawText?: string;

    @Column({ type: DataType.BOOLEAN, allowNull: false })
    deadlineNeedsConfirm: boolean;

    @Column({ type: DataType.STRING, allowNull: false })
    priority: ActionItemPriority;

    @Column({ type: DataType.STRING, allowNull: false })
    status: ActionItemStatus;

    @Column({ type: DataType.TEXT, allowNull: true })
    definitionOfDone?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    source: ActionItemSource;

    @Column({ type: DataType.FLOAT, allowNull: true })
    confidence?: number;

    @Column({ type: DataType.STRING, allowNull: true })
    needsReviewReason?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    createdById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
