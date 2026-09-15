import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { OutboxEvent } from "../entities/outbox-event.entity";

export type OutboxEventRepository = BaseRepository<OutboxEvent>;
