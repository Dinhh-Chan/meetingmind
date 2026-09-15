import { PartialType } from "@nestjs/swagger";
import { Note } from "../entities/note.entity";

export class NoteConditionDto extends PartialType(Note) {}
