import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly meetingParticipantService: MeetingParticipantService) {
        super(meetingParticipantService);
    }
}
