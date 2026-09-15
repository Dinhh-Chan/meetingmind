import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { ProcessedMessage } from "../entities/processed-message.entity";

@Table({
    tableName: "processed_messages",
    timestamps: true,
    updatedAt: false,
    indexes: [
        { fields: ["messageId", "consumer"], unique: true },
    ],
})
export class ProcessedMessageModel extends Model implements ProcessedMessage {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    messageId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    consumer: string;

    @Column({ type: DataType.DATE, allowNull: false })
    processedAt: Date;
}
