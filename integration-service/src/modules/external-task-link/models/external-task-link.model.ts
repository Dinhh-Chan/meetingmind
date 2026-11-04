import { StrObjectId } from "@common/constant";
import { IntegrationProvider } from "@module/integration/common/constant";
import { IntegrationModel } from "@module/integration/models/integration.model";
import {
    BelongsTo,
    Column,
    DataType,
    ForeignKey,
    Model,
    Table,
} from "sequelize-typescript";
import { ExternalSyncStatus } from "../common/constant";
import { ExternalTaskLink } from "../entities/external-task-link.entity";

@Table({
    tableName: "external_task_links",
    timestamps: true,
    indexes: [
        // Gắn theo integrationId: hai workspace cùng dùng Trello không đụng nhau.
        { fields: ["integrationId", "externalId"], unique: true },
        { fields: ["integrationId", "actionItemId"], unique: true },
    ],
})
export class ExternalTaskLinkModel extends Model implements ExternalTaskLink {
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
    actionItemId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    provider: IntegrationProvider;

    @Column({ type: DataType.STRING, allowNull: false })
    externalId: string;

    @Column({ type: DataType.STRING, allowNull: true })
    externalKey?: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    externalUrl?: string;

    @Column({ type: DataType.DATE, allowNull: true })
    lastSyncedAt?: Date;

    @Column({ type: DataType.STRING, allowNull: false })
    syncStatus: ExternalSyncStatus;

    @Column({ type: DataType.TEXT, allowNull: true })
    lastError?: string;
}
