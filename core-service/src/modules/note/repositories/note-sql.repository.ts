import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { Note } from "../entities/note.entity";
import { NoteModel } from "../models/note.model";
import { NoteRepository } from "./note-repository.interface";

@Injectable()
export class NoteSqlRepository
    extends SqlRepository<Note>
    implements NoteRepository
{
    constructor(
        @InjectModel(NoteModel)
        private readonly noteModel: ModelCtor<NoteModel>,
    ) {
        super(noteModel);
    }
}
