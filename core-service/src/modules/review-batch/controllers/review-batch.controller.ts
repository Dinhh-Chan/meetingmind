import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateReviewBatchDto } from "../dto/create-review-batch.dto";
import { ReviewBatchConditionDto } from "../dto/review-batch-condition.dto";
import { UpdateReviewBatchDto } from "../dto/update-review-batch.dto";
import { ReviewBatch } from "../entities/review-batch.entity";
import { ReviewBatchService } from "../services/review-batch.service";

@Controller("review-batch")
@ApiTags("review-batch")
export class ReviewBatchController extends BaseControllerFactory<ReviewBatch>(
    ReviewBatch,
    ReviewBatchConditionDto,
    CreateReviewBatchDto,
    UpdateReviewBatchDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly reviewBatchService: ReviewBatchService) {
        super(reviewBatchService);
    }
}
