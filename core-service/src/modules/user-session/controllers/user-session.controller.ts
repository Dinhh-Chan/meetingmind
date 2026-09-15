import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateUserSessionDto } from "../dto/create-user-session.dto";
import { UserSessionConditionDto } from "../dto/user-session-condition.dto";
import { UpdateUserSessionDto } from "../dto/update-user-session.dto";
import { UserSession } from "../entities/user-session.entity";
import { UserSessionService } from "../services/user-session.service";

@Controller("user-session")
@ApiTags("user-session")
export class UserSessionController extends BaseControllerFactory<UserSession>(
    UserSession,
    UserSessionConditionDto,
    CreateUserSessionDto,
    UpdateUserSessionDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly userSessionService: UserSessionService) {
        super(userSessionService);
    }
}
