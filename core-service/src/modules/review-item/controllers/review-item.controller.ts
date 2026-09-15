import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateReviewItemDto } from "../dto/create-review-item.dto";
import { ReviewItemConditionDto } from "../dto/review-item-condition.dto";
import { UpdateReviewItemDto } from "../dto/update-review-item.dto";
import { ReviewItem } from "../entities/review-item.entity";
import { ReviewItemService } from "../services/review-item.service";

@Controller("review-item")
@ApiTags("review-item")
export class ReviewItemController extends BaseControllerFactory<ReviewItem>(
    ReviewItem,
    ReviewItemConditionDto,
    CreateReviewItemDto,
    UpdateReviewItemDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.MINUTES_VIEW_DRAFT },
            getPage: { permission: Permission.MINUTES_VIEW_DRAFT },
            getOne: { permission: Permission.MINUTES_VIEW_DRAFT },
            getById: { permission: Permission.MINUTES_VIEW_DRAFT },
            exportDefinition: { permission: Permission.MINUTES_VIEW_DRAFT },
            exportXlsx: { permission: Permission.MINUTES_VIEW_DRAFT },
            create: { permission: Permission.REVIEW_UPDATE },
            upsert: { permission: Permission.REVIEW_UPDATE },
            getOneOrUpsert: { permission: Permission.REVIEW_UPDATE },
            updateById: { permission: Permission.REVIEW_UPDATE },
            updateByIds: { permission: Permission.REVIEW_UPDATE },
            deleteById: { permission: Permission.REVIEW_APPROVE },
            deleteByIds: { permission: Permission.REVIEW_APPROVE },
        },
    },
) {
    constructor(private readonly reviewItemService: ReviewItemService) {
        super(reviewItemService);
    }
}
