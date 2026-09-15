import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { Project } from "../entities/project.entity";
import { ProjectStatus } from "../common/constant";

@Table({
    tableName: "projects",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["workspaceId", "status"] },
    ],
})
export class ProjectModel extends Model implements Project {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    name: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    description?: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: ProjectStatus;

    @Column({ type: DataType.STRING, allowNull: false })
    createdById: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
