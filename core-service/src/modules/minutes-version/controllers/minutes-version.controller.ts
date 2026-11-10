import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { SystemRole } from "@module/user/common/constant";
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
        // Đọc thô bản ghi/biên bản của mọi người ghi: chỉ quản trị nền tảng.
        // Giao diện đọc qua /workflow/meetings/:id/content (lọc theo người xem).
        routes: {
            getMany: { roles: [SystemRole.SUPER_ADMIN] },
            getPage: { roles: [SystemRole.SUPER_ADMIN] },
            getOne: { roles: [SystemRole.SUPER_ADMIN] },
            getById: { roles: [SystemRole.SUPER_ADMIN] },
            exportDefinition: { roles: [SystemRole.SUPER_ADMIN] },
            exportXlsx: { roles: [SystemRole.SUPER_ADMIN] },
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
