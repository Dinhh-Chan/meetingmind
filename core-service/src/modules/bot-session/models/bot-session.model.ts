import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { BotSession } from "../entities/bot-session.entity";
import { BotSessionStatus } from "../common/constant";

@Table({
    tableName: "bot_sessions",
    timestamps: true,
    indexes: [
        { fields: ["meetingId", "attempt"], unique: true },
        { fields: ["workspaceId", "status"] },
    ],
})
export class BotSessionModel extends Model implements BotSession {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    workspaceId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    meetingId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    status: BotSessionStatus;

    @Column({ type: DataType.TEXT, allowNull: false })
    joinUrl: string;

    @Column({ type: DataType.INTEGER, allowNull: false })
    attempt: number;

    @Column({ type: DataType.DATE, allowNull: true })
    startedAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    endedAt?: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    heartbeatAt?: Date;

    @Column({ type: DataType.TEXT, allowNull: true })
    error?: string;
}
