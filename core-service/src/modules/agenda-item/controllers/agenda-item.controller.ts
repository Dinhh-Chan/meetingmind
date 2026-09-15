import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateAgendaItemDto } from "../dto/create-agenda-item.dto";
import { AgendaItemConditionDto } from "../dto/agenda-item-condition.dto";
import { UpdateAgendaItemDto } from "../dto/update-agenda-item.dto";
import { AgendaItem } from "../entities/agenda-item.entity";
import { AgendaItemService } from "../services/agenda-item.service";

@Controller("agenda-item")
@ApiTags("agenda-item")
export class AgendaItemController extends BaseControllerFactory<AgendaItem>(
    AgendaItem,
    AgendaItemConditionDto,
    CreateAgendaItemDto,
    UpdateAgendaItemDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly agendaItemService: AgendaItemService) {
        super(agendaItemService);
    }
}
