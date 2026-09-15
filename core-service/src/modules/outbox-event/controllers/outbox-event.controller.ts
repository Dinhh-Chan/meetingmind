import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateOutboxEventDto } from "../dto/create-outbox-event.dto";
import { OutboxEventConditionDto } from "../dto/outbox-event-condition.dto";
import { UpdateOutboxEventDto } from "../dto/update-outbox-event.dto";
import { OutboxEvent } from "../entities/outbox-event.entity";
import { OutboxEventService } from "../services/outbox-event.service";

@Controller("outbox-event")
@ApiTags("outbox-event")
export class OutboxEventController extends BaseControllerFactory<OutboxEvent>(
    OutboxEvent,
    OutboxEventConditionDto,
    CreateOutboxEventDto,
    UpdateOutboxEventDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly outboxEventService: OutboxEventService) {
        super(outboxEventService);
    }
}
