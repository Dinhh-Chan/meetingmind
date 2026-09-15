import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Workspace } from "../entities/workspace.entity";
import { WorkspacePlan } from "../common/constant";

@Table({
    tableName: "workspaces",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["slug"], unique: true },
        { fields: ["ownerId"] },
    ],
})
export class WorkspaceModel extends Model implements Workspace {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    name: string;

    @Column({ type: DataType.STRING, allowNull: false })
    slug: string;

    @Column({ type: DataType.STRING, allowNull: false })
    ownerId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    plan: WorkspacePlan;

    @Column({ type: DataType.STRING, allowNull: false })
    timezone: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
