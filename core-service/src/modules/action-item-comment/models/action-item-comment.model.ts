import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ActionItemComment } from "../entities/action-item-comment.entity";

@Table({
    tableName: "action_item_comments",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["actionItemId"] },
    ],
})
export class ActionItemCommentModel extends Model implements ActionItemComment {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    actionItemId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    authorId: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    body: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
