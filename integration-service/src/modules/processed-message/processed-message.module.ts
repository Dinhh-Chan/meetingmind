import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { ProcessedMessageSqlRepository } from "./repositories/processed-message-sql.repository";
import { ProcessedMessageService } from "./services/processed-message.service";

/** Không mở controller: bảng chống xử lý lặp chỉ dùng nội bộ. */
@Module({
    providers: [
        ProcessedMessageService,
        RepositoryProvider(
            Entity.PROCESSED_MESSAGE,
            ProcessedMessageSqlRepository,
        ),
        TransactionProvider(SqlTransaction),
    ],
    exports: [ProcessedMessageService],
})
export class ProcessedMessageModule {}
