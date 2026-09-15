import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        scopeParam: "meetingId",
        routes: {
            getMany: { permission: Permission.MEETING_VIEW },
            getPage: { permission: Permission.MEETING_VIEW },
            getOne: { permission: Permission.MEETING_VIEW },
            getById: { permission: Permission.MEETING_VIEW },
            exportDefinition: { permission: Permission.MEETING_VIEW },
            exportXlsx: { permission: Permission.MEETING_VIEW },
            create: { permission: Permission.MEETING_CREATE },
            upsert: { permission: Permission.MEETING_CREATE },
            getOneOrUpsert: { permission: Permission.MEETING_CREATE },
            updateById: { permission: Permission.MEETING_UPDATE },
            updateByIds: { permission: Permission.MEETING_UPDATE },
            deleteById: { permission: Permission.MEETING_DELETE },
            deleteByIds: { permission: Permission.MEETING_DELETE },
        },
    },
) {
    constructor(private readonly meetingService: MeetingService) {
        super(meetingService);
    }
}
