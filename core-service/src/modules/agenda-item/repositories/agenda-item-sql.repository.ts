import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { AgendaItem } from "../entities/agenda-item.entity";
import { AgendaItemModel } from "../models/agenda-item.model";
import { AgendaItemRepository } from "./agenda-item-repository.interface";

@Injectable()
export class AgendaItemSqlRepository
    extends SqlRepository<AgendaItem>
    implements AgendaItemRepository
{
    constructor(
        @InjectModel(AgendaItemModel)
        private readonly agendaItemModel: ModelCtor<AgendaItemModel>,
    ) {
        super(agendaItemModel);
    }
}
