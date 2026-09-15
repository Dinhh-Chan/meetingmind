import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { SpeakerAliasController } from "./controllers/speaker-alias.controller";
import { SpeakerAliasSqlRepository } from "./repositories/speaker-alias-sql.repository";
import { SpeakerAliasService } from "./services/speaker-alias.service";

@Module({
    controllers: [SpeakerAliasController],
    providers: [
        SpeakerAliasService,
        RepositoryProvider(Entity.SPEAKER_ALIAS, SpeakerAliasSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [SpeakerAliasService],
})
export class SpeakerAliasModule {}
