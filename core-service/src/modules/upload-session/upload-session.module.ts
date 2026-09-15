import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { UploadSessionController } from "./controllers/upload-session.controller";
import { UploadSessionSqlRepository } from "./repositories/upload-session-sql.repository";
import { UploadSessionService } from "./services/upload-session.service";

@Module({
    controllers: [UploadSessionController],
    providers: [
        UploadSessionService,
        RepositoryProvider(Entity.UPLOAD_SESSION, UploadSessionSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [UploadSessionService],
})
export class UploadSessionModule {}
