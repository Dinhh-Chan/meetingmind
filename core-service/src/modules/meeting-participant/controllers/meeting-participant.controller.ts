import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMeetingParticipantDto } from "../dto/create-meeting-participant.dto";
import { MeetingParticipantConditionDto } from "../dto/meeting-participant-condition.dto";
import { UpdateMeetingParticipantDto } from "../dto/update-meeting-participant.dto";
import { MeetingParticipant } from "../entities/meeting-participant.entity";
import { MeetingParticipantService } from "../services/meeting-participant.service";

@Controller("meeting-participant")
@ApiTags("meeting-participant")
export class MeetingParticipantController extends BaseControllerFactory<MeetingParticipant>(
    MeetingParticipant,
    MeetingParticipantConditionDto,
    CreateMeetingParticipantDto,
    UpdateMeetingParticipantDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.MEETING_VIEW },
            getPage: { permission: Permission.MEETING_VIEW },
            getOne: { permission: Permission.MEETING_VIEW },
            getById: { permission: Permission.MEETING_VIEW },
            exportDefinition: { permission: Permission.MEETING_VIEW },
            exportXlsx: { permission: Permission.MEETING_VIEW },
            create: { permission: Permission.MEETING_UPDATE },
            upsert: { permission: Permission.MEETING_UPDATE },
            getOneOrUpsert: { permission: Permission.MEETING_UPDATE },
            updateById: { permission: Permission.MEETING_UPDATE },
            updateByIds: { permission: Permission.MEETING_UPDATE },
            deleteById: { permission: Permission.MEETING_UPDATE },
            deleteByIds: { permission: Permission.MEETING_UPDATE },
        },
    },
) {
    constructor(private readonly meetingParticipantService: MeetingParticipantService) {
        super(meetingParticipantService);
    }
}
