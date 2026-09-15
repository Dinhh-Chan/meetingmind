import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly reviewItemService: ReviewItemService) {
        super(reviewItemService);
    }
}
