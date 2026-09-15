import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { RecordingConsentController } from "./controllers/recording-consent.controller";
import { RecordingConsentSqlRepository } from "./repositories/recording-consent-sql.repository";
import { RecordingConsentService } from "./services/recording-consent.service";

@Module({
    controllers: [RecordingConsentController],
    providers: [
        RecordingConsentService,
        RepositoryProvider(Entity.RECORDING_CONSENT, RecordingConsentSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [RecordingConsentService],
})
export class RecordingConsentModule {}
