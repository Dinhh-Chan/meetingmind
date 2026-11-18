import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ClarificationStatus } from "../common/constant";
import { ClarificationRequest } from "../entities/clarification-request.entity";

@Table({
    tableName: "clarification_requests",
    timestamps: true,
    indexes: [
        { fields: ["recipientId", "status"] },
        { fields: ["reviewItemId"] },
        { fields: ["workspaceId"] },
    ],
})
export class ClarificationRequestModel extends Model implements ClarificationRequest {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    reviewItemId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    askedById: string;

    @Column({ type: DataType.STRING, allowNull: false })
    recipientId: string;

    @Column({ type: DataType.TEXT, allowNull: false })
    question: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: ClarificationStatus;

    @Column({ type: DataType.TEXT, allowNull: true })
    answer?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    answeredAt?: Date;

    /** Người thực hiện mà người được hỏi chọn khi phản hồi (điền luôn vào đề xuất). */
    @Column({ type: DataType.STRING, allowNull: true })
    answerAssigneeId?: string;

    /** Thời hạn (YYYY-MM-DD) mà người được hỏi chốt khi phản hồi. */
    @Column({ type: DataType.STRING(10), allowNull: true })
    answerDeadline?: string;
}
