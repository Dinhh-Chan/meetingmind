import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { TaskDependency } from "../entities/task-dependency.entity";

@Table({
    tableName: "task_dependencies",
    timestamps: true,
    indexes: [
        { fields: ["actionItemId", "dependsOnActionItemId"], unique: true },
    ],
})
export class TaskDependencyModel extends Model implements TaskDependency {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    actionItemId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    dependsOnActionItemId: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    note?: string;
}
