import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateUploadSessionDto } from "../dto/create-upload-session.dto";
import { UploadSessionConditionDto } from "../dto/upload-session-condition.dto";
import { UpdateUploadSessionDto } from "../dto/update-upload-session.dto";
import { UploadSession } from "../entities/upload-session.entity";
import { UploadSessionService } from "../services/upload-session.service";

@Controller("upload-session")
@ApiTags("upload-session")
export class UploadSessionController extends BaseControllerFactory<UploadSession>(
    UploadSession,
    UploadSessionConditionDto,
    CreateUploadSessionDto,
    UpdateUploadSessionDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.MEETING_VIEW },
            getPage: { permission: Permission.MEETING_VIEW },
            getOne: { permission: Permission.MEETING_VIEW },
            getById: { permission: Permission.MEETING_VIEW },
            exportDefinition: { permission: Permission.MEETING_VIEW },
            exportXlsx: { permission: Permission.MEETING_VIEW },
            create: { permission: Permission.MEETING_RECORDING_CONTROL },
            upsert: { permission: Permission.MEETING_RECORDING_CONTROL },
            getOneOrUpsert: { permission: Permission.MEETING_RECORDING_CONTROL },
            updateById: { permission: Permission.MEETING_RECORDING_CONTROL },
            updateByIds: { permission: Permission.MEETING_RECORDING_CONTROL },
            deleteById: { permission: Permission.MEETING_RECORDING_CONTROL },
            deleteByIds: { permission: Permission.MEETING_RECORDING_CONTROL },
        },
    },
) {
    constructor(private readonly uploadSessionService: UploadSessionService) {
        super(uploadSessionService);
    }
}
