import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ProjectMember } from "../entities/project-member.entity";
import { ProjectDiscipline, ProjectMemberRole } from "../common/constant";

@Table({
    tableName: "project_members",
    timestamps: true,
    indexes: [
        { fields: ["projectId", "userId"], unique: true },
    ],
})
export class ProjectMemberModel extends Model implements ProjectMember {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    projectId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    userId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    role: ProjectMemberRole;

    @Column({ type: DataType.STRING, allowNull: true })
    discipline?: ProjectDiscipline;
}
