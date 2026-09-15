import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly minutesVersionService: MinutesVersionService) {
        super(minutesVersionService);
    }
}
