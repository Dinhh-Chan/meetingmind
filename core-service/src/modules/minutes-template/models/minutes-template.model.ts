import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { MinutesTemplate } from "../entities/minutes-template.entity";

@Table({
    tableName: "minutes_templates",
    timestamps: true,
    indexes: [{ fields: ["workspaceId"] }],
})
export class MinutesTemplateModel extends Model implements MinutesTemplate {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    name: string;

    @Column({ type: DataType.JSONB, allowNull: false })
    sections: string[];

    @Column({ type: DataType.STRING, allowNull: true })
    createdById?: string;
}
