import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { Note } from "../entities/note.entity";

export type NoteRepository = BaseRepository<Note>;
