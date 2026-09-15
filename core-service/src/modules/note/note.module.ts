import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { TransactionProvider } from "@module/repository/common/transaction";
import { SqlTransaction } from "@module/repository/sequelize/sql.transaction";
import { Module } from "@nestjs/common";
import { NoteController } from "./controllers/note.controller";
import { NoteSqlRepository } from "./repositories/note-sql.repository";
import { NoteService } from "./services/note.service";

@Module({
    controllers: [NoteController],
    providers: [
        NoteService,
        RepositoryProvider(Entity.NOTE, NoteSqlRepository),
        TransactionProvider(SqlTransaction),
    ],
    exports: [NoteService],
})
export class NoteModule {}
