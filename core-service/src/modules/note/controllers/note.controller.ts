import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateNoteDto } from "../dto/create-note.dto";
import { NoteConditionDto } from "../dto/note-condition.dto";
import { UpdateNoteDto } from "../dto/update-note.dto";
import { Note } from "../entities/note.entity";
import { NoteService } from "../services/note.service";

@Controller("note")
@ApiTags("note")
export class NoteController extends BaseControllerFactory<Note>(
    Note,
    NoteConditionDto,
    CreateNoteDto,
    UpdateNoteDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly noteService: NoteService) {
        super(noteService);
    }
}
