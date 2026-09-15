import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMeetingDto } from "../dto/create-meeting.dto";
import { MeetingConditionDto } from "../dto/meeting-condition.dto";
import { UpdateMeetingDto } from "../dto/update-meeting.dto";
import { Meeting } from "../entities/meeting.entity";
import { MeetingService } from "../services/meeting.service";

@Controller("meeting")
@ApiTags("meeting")
export class MeetingController extends BaseControllerFactory<Meeting>(
    Meeting,
    MeetingConditionDto,
    CreateMeetingDto,
    UpdateMeetingDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly meetingService: MeetingService) {
        super(meetingService);
    }
}
