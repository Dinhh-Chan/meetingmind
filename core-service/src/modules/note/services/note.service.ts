import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { Note } from "../entities/note.entity";
import { NoteRepository } from "../repositories/note-repository.interface";

@Injectable()
export class NoteService extends BaseService<Note, NoteRepository> {
    constructor(
        @InjectRepository(Entity.NOTE)
        private readonly noteRepository: NoteRepository,
    ) {
        super(noteRepository);
    }
}
