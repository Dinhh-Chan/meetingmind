import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.MEETING_VIEW },
            getPage: { permission: Permission.MEETING_VIEW },
            getOne: { permission: Permission.MEETING_VIEW },
            getById: { permission: Permission.MEETING_VIEW },
            exportDefinition: { permission: Permission.MEETING_VIEW },
            exportXlsx: { permission: Permission.MEETING_VIEW },
            create: { permission: Permission.MEETING_VIEW },
            upsert: { permission: Permission.MEETING_VIEW },
            getOneOrUpsert: { permission: Permission.MEETING_VIEW },
            updateById: { permission: Permission.MEETING_VIEW },
            updateByIds: { permission: Permission.MEETING_VIEW },
            deleteById: { permission: Permission.MEETING_VIEW },
            deleteByIds: { permission: Permission.MEETING_VIEW },
        },
    },
) {
    constructor(private readonly noteService: NoteService) {
        super(noteService);
    }
}
