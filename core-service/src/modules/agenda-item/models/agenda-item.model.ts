import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { AgendaItem } from "../entities/agenda-item.entity";

@Table({
    tableName: "agenda_items",
    timestamps: true,
    indexes: [
        { fields: ["meetingId", "sequence"], unique: true },
    ],
})
export class AgendaItemModel extends Model implements AgendaItem {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    title: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    description?: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    sequence: number;

    @Column({ type: DataType.INTEGER, allowNull: true })
    plannedMinutes?: number;

    @Column({ type: DataType.STRING, allowNull: true })
    carriedFromActionItemId?: string;
}
