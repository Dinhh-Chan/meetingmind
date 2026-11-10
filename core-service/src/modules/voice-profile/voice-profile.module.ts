import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { VoiceProfileController } from "./controllers/voice-profile.controller";
import { VoiceProfileSqlRepository } from "./repositories/voice-profile-sql.repository";
import { VoiceAiClient } from "./services/voice-ai.client";
import { VoiceProfileService } from "./services/voice-profile.service";

@Module({
    imports: [HttpModule],
    controllers: [VoiceProfileController],
    providers: [
        VoiceProfileService,
        VoiceAiClient,
        RepositoryProvider(Entity.VOICE_PROFILE, VoiceProfileSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [VoiceProfileService],
})
export class VoiceProfileModule {}
