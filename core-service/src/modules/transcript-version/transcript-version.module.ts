import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { TranscriptVersionController } from "./controllers/transcript-version.controller";
import { TranscriptVersionSqlRepository } from "./repositories/transcript-version-sql.repository";
import { TranscriptVersionService } from "./services/transcript-version.service";

@Module({
    controllers: [TranscriptVersionController],
    providers: [
        TranscriptVersionService,
        RepositoryProvider(Entity.TRANSCRIPT_VERSION, TranscriptVersionSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [TranscriptVersionService],
})
export class TranscriptVersionModule {}
