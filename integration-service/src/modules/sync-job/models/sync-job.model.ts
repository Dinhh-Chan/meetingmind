import { StrObjectId } from "@common/constant";
import { IntegrationModel } from "@module/integration/models/integration.model";
import {
    BelongsTo,
    Column,
    DataType,
    ForeignKey,
    Model,
    Table,
} from "sequelize-typescript";
import { SyncJobStatus, SyncJobType } from "../common/constant";
import { SyncJob } from "../entities/sync-job.entity";

@Table({
    tableName: "sync_jobs",
    timestamps: true,
    indexes: [{ fields: ["idempotencyKey"], unique: true }],
})
export class SyncJobModel extends Model implements SyncJob {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @ForeignKey(() => IntegrationModel)
    @Column({ type: DataType.STRING, allowNull: false })
    integrationId: string;

    @BelongsTo(() => IntegrationModel)
    integration?: IntegrationModel;

    @Column({ type: DataType.STRING, allowNull: false })
    type: SyncJobType;

    @Column({ type: DataType.STRING, allowNull: false })
    status: SyncJobStatus;

    @Column({ type: DataType.STRING, allowNull: false })
    idempotencyKey: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    payload: Record<string, any>;

    @Column({ type: DataType.JSONB, allowNull: true })
    result?: Record<string, any>;

    @Column({ type: DataType.TEXT, allowNull: true })
    error?: string;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
    retryCount: number;

    @Column({ type: DataType.DATE, allowNull: true })
    startedAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    finishedAt?: Date;
}
