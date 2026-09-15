import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { UserSession } from "../entities/user-session.entity";
import { UserSessionRepository } from "../repositories/user-session-repository.interface";

@Injectable()
export class UserSessionService extends BaseService<UserSession, UserSessionRepository> {
    constructor(
        @InjectRepository(Entity.USER_SESSION)
        private readonly userSessionRepository: UserSessionRepository,
    ) {
        super(userSessionRepository);
    }
}
