import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.MEETING_VIEW },
            getPage: { permission: Permission.MEETING_VIEW },
            getOne: { permission: Permission.MEETING_VIEW },
            getById: { permission: Permission.MEETING_VIEW },
            exportDefinition: { permission: Permission.MEETING_VIEW },
            exportXlsx: { permission: Permission.MEETING_VIEW },
            create: { permission: Permission.MEETING_UPDATE },
            upsert: { permission: Permission.MEETING_UPDATE },
            getOneOrUpsert: { permission: Permission.MEETING_UPDATE },
            updateById: { permission: Permission.MEETING_UPDATE },
            updateByIds: { permission: Permission.MEETING_UPDATE },
            deleteById: { permission: Permission.MEETING_UPDATE },
            deleteByIds: { permission: Permission.MEETING_UPDATE },
        },
    },
) {
    constructor(private readonly agendaItemService: AgendaItemService) {
        super(agendaItemService);
    }
}
