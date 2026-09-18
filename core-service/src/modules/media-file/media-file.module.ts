import { MinioModule } from "@module/minio/minio.module";
import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MediaFileController } from "./controllers/media-file.controller";
import { MediaFileSqlRepository } from "./repositories/media-file-sql.repository";
import { MediaFileUploadController } from "./controllers/media-file-upload.controller";
import { MediaFileUploadService } from "./services/media-file-upload.service";
import { MediaFileService } from "./services/media-file.service";

@Module({
    imports: [MinioModule],
    controllers: [MediaFileController, MediaFileUploadController],
    providers: [
        MediaFileService,
        MediaFileUploadService,
        RepositoryProvider(Entity.MEDIA_FILE, MediaFileSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MediaFileService, MediaFileUploadService],
})
export class MediaFileModule {}
