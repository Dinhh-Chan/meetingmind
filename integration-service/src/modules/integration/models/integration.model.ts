import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { IntegrationProvider, IntegrationStatus } from "../common/constant";
import { Integration } from "../entities/integration.entity";

@Table({
    tableName: "integrations",
    timestamps: true,
    indexes: [
        {
            fields: ["workspaceId", "provider", "externalAccountId"],
            unique: true,
        },
    ],
})
export class IntegrationModel extends Model implements Integration {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    provider: IntegrationProvider;

    @Column({ type: DataType.STRING, allowNull: true })
    externalAccountId?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    displayName?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: IntegrationStatus;

    @Column({ type: DataType.JSONB, allowNull: true })
    config?: Record<string, any>;

    @Column({ type: DataType.TEXT, allowNull: true })
    lastError?: string;
}
