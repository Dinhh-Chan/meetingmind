import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMediaFileDto } from "../dto/create-media-file.dto";
import { MediaFileConditionDto } from "../dto/media-file-condition.dto";
import { UpdateMediaFileDto } from "../dto/update-media-file.dto";
import { MediaFile } from "../entities/media-file.entity";
import { MediaFileService } from "../services/media-file.service";

@Controller("media-file")
@ApiTags("media-file")
export class MediaFileController extends BaseControllerFactory<MediaFile>(
    MediaFile,
    MediaFileConditionDto,
    CreateMediaFileDto,
    UpdateMediaFileDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly mediaFileService: MediaFileService) {
        super(mediaFileService);
    }
}
