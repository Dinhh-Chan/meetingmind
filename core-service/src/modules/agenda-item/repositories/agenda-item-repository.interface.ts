import { BaseRepository } from "@module/repository/common/base-repository.interface";
import { AgendaItem } from "../entities/agenda-item.entity";

export type AgendaItemRepository = BaseRepository<AgendaItem>;
