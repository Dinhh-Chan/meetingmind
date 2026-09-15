import { StrObjectId } from "@common/constant";
import { Column, DataType, Model, Table } from "sequelize-typescript";
import { OauthAccount } from "../entities/oauth-account.entity";
import { OauthProvider } from "../common/constant";

@Table({
    tableName: "oauth_accounts",
    timestamps: true,
    paranoid: true,
    indexes: [
        { fields: ["provider", "providerAccountId"], unique: true },
        { fields: ["userId"] },
    ],
})
export class OauthAccountModel extends Model implements OauthAccount {
    @StrObjectId()
    _id: string;

    @Column({ type: DataType.STRING, allowNull: false })
    userId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    provider: OauthProvider;

    @Column({ type: DataType.STRING, allowNull: false })
    providerAccountId: string;

    @Column({ type: DataType.STRING, allowNull: false })
    email: string;

    @Column({ type: DataType.DATE, allowNull: true })
    deletedAt?: Date;
}
