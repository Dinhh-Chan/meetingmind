import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { WorkspaceSetting } from "../entities/workspace-setting.entity";

@Table({
    tableName: "workspace_settings",
    timestamps: true,
    indexes: [
        { fields: ["workspaceId"], unique: true },
    ],
})
export class WorkspaceSettingModel extends Model implements WorkspaceSetting {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.JSONB, allowNull: true })
    minutesTemplate?: Record<string, any>;

    @Column({ type: DataType.JSONB, allowNull: true })
    reminderRules?: Record<string, any>;

    @Column({ type: DataType.INTEGER, allowNull: false })
    audioRetentionDays: number;

    @Column({ type: DataType.INTEGER, allowNull: true })
    transcriptRetentionDays?: number;

    @Column({ type: DataType.BOOLEAN, allowNull: false })
    autoJoinEnabled: boolean;

    @Column({ type: DataType.BOOLEAN, allowNull: false })
    autoSyncEnabled: boolean;
}
