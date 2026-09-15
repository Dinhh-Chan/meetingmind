import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { UserSession } from "../entities/user-session.entity";

export type UserSessionRepository = BaseRepository<UserSession>;
