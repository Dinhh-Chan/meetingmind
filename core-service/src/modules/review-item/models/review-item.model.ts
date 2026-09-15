import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ReviewItem } from "../entities/review-item.entity";
import { ReviewItemStatus, ReviewItemType } from "../common/constant";

@Table({
    tableName: "review_items",
    timestamps: true,
    indexes: [
        { fields: ["reviewBatchId"] },
        { fields: ["workspaceId", "status"] },
    ],
})
export class ReviewItemModel extends Model implements ReviewItem {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    reviewBatchId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    type: ReviewItemType;

    @Column({ type: DataType.JSONB, allowNull: false })
    originalPayload: Record<string, any>;

    @Column({ type: DataType.JSONB, allowNull: false })
    payload: Record<string, any>;

    @Column({ type: DataType.STRING, allowNull: false })
    status: ReviewItemStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    editedById?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    editedAt?: Date;

    @Column({ type: DataType.TEXT, allowNull: true })
    rejectReason?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    actionItemId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    decisionId?: string;
}
