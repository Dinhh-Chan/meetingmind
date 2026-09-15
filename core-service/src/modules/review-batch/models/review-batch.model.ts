import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ReviewBatch } from "../entities/review-batch.entity";
import { ReviewBatchStatus } from "../common/constant";

@Table({
    tableName: "review_batches",
    timestamps: true,
    indexes: [
        { fields: ["workspaceId", "status"] },
        { fields: ["meetingId"] },
    ],
})
export class ReviewBatchModel extends Model implements ReviewBatch {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: ReviewBatchStatus;

    @Column({ type: DataType.STRING, allowNull: true })
    sourceTranscriptVersionId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    aiRunId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    reviewerId?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    reviewedAt?: Date;
}
