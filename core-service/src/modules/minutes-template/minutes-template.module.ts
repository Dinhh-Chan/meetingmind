import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { MinutesTemplateSqlRepository } from "./repositories/minutes-template-sql.repository";
import { MinutesTemplateService } from "./services/minutes-template.service";

@Module({
    providers: [
        MinutesTemplateService,
        RepositoryProvider(Entity.MINUTES_TEMPLATE, MinutesTemplateSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [MinutesTemplateService],
})
export class MinutesTemplateModule {}
