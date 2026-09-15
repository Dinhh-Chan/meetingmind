import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMeetingAccessDto } from "../dto/create-meeting-access.dto";
import { MeetingAccessConditionDto } from "../dto/meeting-access-condition.dto";
import { UpdateMeetingAccessDto } from "../dto/update-meeting-access.dto";
import { MeetingAccess } from "../entities/meeting-access.entity";
import { MeetingAccessService } from "../services/meeting-access.service";

@Controller("meeting-access")
@ApiTags("meeting-access")
export class MeetingAccessController extends BaseControllerFactory<MeetingAccess>(
    MeetingAccess,
    MeetingAccessConditionDto,
    CreateMeetingAccessDto,
    UpdateMeetingAccessDto,
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
    constructor(private readonly meetingAccessService: MeetingAccessService) {
        super(meetingAccessService);
    }
}
