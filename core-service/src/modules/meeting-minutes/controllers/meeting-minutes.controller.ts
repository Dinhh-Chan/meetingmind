import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.MINUTES_VIEW_APPROVED },
            getPage: { permission: Permission.MINUTES_VIEW_APPROVED },
            getOne: { permission: Permission.MINUTES_VIEW_APPROVED },
            getById: { permission: Permission.MINUTES_VIEW_APPROVED },
            exportDefinition: { permission: Permission.MINUTES_VIEW_APPROVED },
            exportXlsx: { permission: Permission.MINUTES_VIEW_APPROVED },
            create: { permission: Permission.MINUTES_UPDATE_DRAFT },
            upsert: { permission: Permission.MINUTES_UPDATE_DRAFT },
            getOneOrUpsert: { permission: Permission.MINUTES_UPDATE_DRAFT },
            updateById: { permission: Permission.MINUTES_APPROVE },
            updateByIds: { permission: Permission.MINUTES_APPROVE },
            deleteById: { permission: Permission.MINUTES_APPROVE },
            deleteByIds: { permission: Permission.MINUTES_APPROVE },
        },
    },
) {
    constructor(private readonly meetingMinutesService: MeetingMinutesService) {
        super(meetingMinutesService);
    }
}
