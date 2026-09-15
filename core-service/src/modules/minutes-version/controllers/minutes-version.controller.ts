import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMinutesVersionDto } from "../dto/create-minutes-version.dto";
import { MinutesVersionConditionDto } from "../dto/minutes-version-condition.dto";
import { UpdateMinutesVersionDto } from "../dto/update-minutes-version.dto";
import { MinutesVersion } from "../entities/minutes-version.entity";
import { MinutesVersionService } from "../services/minutes-version.service";

@Controller("minutes-version")
@ApiTags("minutes-version")
export class MinutesVersionController extends BaseControllerFactory<MinutesVersion>(
    MinutesVersion,
    MinutesVersionConditionDto,
    CreateMinutesVersionDto,
    UpdateMinutesVersionDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.MINUTES_VIEW_DRAFT },
            getPage: { permission: Permission.MINUTES_VIEW_DRAFT },
            getOne: { permission: Permission.MINUTES_VIEW_DRAFT },
            getById: { permission: Permission.MINUTES_VIEW_DRAFT },
            exportDefinition: { permission: Permission.MINUTES_VIEW_DRAFT },
            exportXlsx: { permission: Permission.MINUTES_VIEW_DRAFT },
            create: { permission: Permission.MINUTES_UPDATE_DRAFT },
            upsert: { permission: Permission.MINUTES_UPDATE_DRAFT },
            getOneOrUpsert: { permission: Permission.MINUTES_UPDATE_DRAFT },
            updateById: { permission: Permission.MINUTES_UPDATE_DRAFT },
            updateByIds: { permission: Permission.MINUTES_UPDATE_DRAFT },
            deleteById: { permission: Permission.MINUTES_APPROVE },
            deleteByIds: { permission: Permission.MINUTES_APPROVE },
        },
    },
) {
    constructor(private readonly minutesVersionService: MinutesVersionService) {
        super(minutesVersionService);
    }
}
