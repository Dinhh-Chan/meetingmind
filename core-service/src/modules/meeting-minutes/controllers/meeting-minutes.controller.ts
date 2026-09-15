import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMeetingMinutesDto } from "../dto/create-meeting-minutes.dto";
import { MeetingMinutesConditionDto } from "../dto/meeting-minutes-condition.dto";
import { UpdateMeetingMinutesDto } from "../dto/update-meeting-minutes.dto";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";
import { MeetingMinutesService } from "../services/meeting-minutes.service";

@Controller("meeting-minutes")
@ApiTags("meeting-minutes")
export class MeetingMinutesController extends BaseControllerFactory<MeetingMinutes>(
    MeetingMinutes,
    MeetingMinutesConditionDto,
    CreateMeetingMinutesDto,
    UpdateMeetingMinutesDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly meetingMinutesService: MeetingMinutesService) {
        super(meetingMinutesService);
    }
}
