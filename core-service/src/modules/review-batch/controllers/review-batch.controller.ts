import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
    constructor(private readonly reviewBatchService: ReviewBatchService) {
        super(reviewBatchService);
    }
}
