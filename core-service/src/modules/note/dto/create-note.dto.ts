import { OmitType } from "@nestjs/swagger";
import { Note } from "../entities/note.entity";

export class CreateNoteDto extends OmitType(Note, ["_id"] as const) {}
