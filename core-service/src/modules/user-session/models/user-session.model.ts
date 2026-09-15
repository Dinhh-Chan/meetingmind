import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { UserSession } from "../entities/user-session.entity";

@Table({
    tableName: "user_sessions",
    timestamps: true,
    indexes: [
        { fields: ["userId", "expiresAt"] },
    ],
})
export class UserSessionModel extends Model implements UserSession {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    userId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    refreshTokenHash: string;

    @Column({ type: DataType.STRING, allowNull: true })
    userAgent?: string;

    @Column({ type: DataType.STRING, allowNull: true })
    ipAddress?: string;

    @Column({ type: DataType.DATE, allowNull: false })
    expiresAt: Date;

    @Column({ type: DataType.DATE, allowNull: true })
    revokedAt?: Date;
}
