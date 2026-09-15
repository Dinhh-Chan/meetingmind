import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ProcessingJob } from "../entities/processing-job.entity";
import { ProcessingJobStatus, ProcessingJobType } from "../common/constant";

@Table({
    tableName: "processing_jobs",
    timestamps: true,
    indexes: [
        { fields: ["idempotencyKey"], unique: true },
        { fields: ["workspaceId", "status"] },
        { fields: ["status", "nextRetryAt"] },
    ],
})
export class ProcessingJobModel extends Model implements ProcessingJob {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    meetingId?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    type: ProcessingJobType;

    @Column({ type: DataType.STRING, allowNull: false })
    status: ProcessingJobStatus;

    @Column({ type: DataType.STRING, allowNull: false })
    idempotencyKey: string;

    @Column({ type: DataType.STRING, allowNull: true })
    inputVersion?: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    payload: Record<string, any>;

    @Column({ type: DataType.JSONB, allowNull: true })
    result?: Record<string, any>;

    @Column({ type: DataType.TEXT, allowNull: true })
    error?: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    retryCount: number;

    @Column({ type: DataType.DATE, allowNull: true })
    nextRetryAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    startedAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    finishedAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    heartbeatAt?: Date;
}
