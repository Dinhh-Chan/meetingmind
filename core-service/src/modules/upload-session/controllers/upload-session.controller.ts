import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly uploadSessionService: UploadSessionService) {
        super(uploadSessionService);
    }
}
