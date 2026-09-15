import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { WorkspaceMember } from "../entities/workspace-member.entity";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../common/constant";

@Table({
    tableName: "workspace_members",
    timestamps: true,
    indexes: [
        { fields: ["workspaceId", "userId"], unique: true },
    ],
})
export class WorkspaceMemberModel extends Model implements WorkspaceMember {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    userId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    role: WorkspaceMemberRole;

    @Column({ type: DataType.STRING, allowNull: false })
    status: WorkspaceMemberStatus;

    @Column({ type: DataType.DATE, allowNull: true })
    joinedAt?: Date;
}
