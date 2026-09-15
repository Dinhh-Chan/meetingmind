import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { OutboxEvent } from "../entities/outbox-event.entity";
import { OutboxStatus } from "../common/constant";

@Table({
    tableName: "outbox_events",
    timestamps: true,
    indexes: [
        { fields: ["status", "createdAt"] },
    ],
})
export class OutboxEventModel extends Model implements OutboxEvent {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    aggregateType: string;

    @Column({ type: DataType.STRING, allowNull: false })
    aggregateId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    eventType: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    eventVersion: number;

    @Column({ type: DataType.JSONB, allowNull: false })
    payload: Record<string, any>;

    @Column({ type: DataType.STRING, allowNull: false })
    status: OutboxStatus;

    @Column({ type: DataType.DATE, allowNull: true })
    publishedAt?: Date;

    @Column({ type: DataType.INTEGER, allowNull: false })
    retryCount: number;
}
