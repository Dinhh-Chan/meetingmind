import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { Meeting } from "../entities/meeting.entity";

export type MeetingRepository = BaseRepository<Meeting>;
