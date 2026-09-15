import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MinutesVersionController } from "./controllers/minutes-version.controller";
import { MinutesVersionSqlRepository } from "./repositories/minutes-version-sql.repository";
import { MinutesVersionService } from "./services/minutes-version.service";

@Module({
    controllers: [MinutesVersionController],
    providers: [
        MinutesVersionService,
        RepositoryProvider(Entity.MINUTES_VERSION, MinutesVersionSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MinutesVersionService],
})
export class MinutesVersionModule {}
