import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { SystemRole } from "@module/user/common/constant";
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
        // Đọc thô bản ghi/biên bản của mọi người ghi: chỉ quản trị nền tảng.
        // Giao diện đọc qua /workflow/meetings/:id/content (lọc theo người xem).
        routes: {
            getMany: { roles: [SystemRole.SUPER_ADMIN] },
            getPage: { roles: [SystemRole.SUPER_ADMIN] },
            getOne: { roles: [SystemRole.SUPER_ADMIN] },
            getById: { roles: [SystemRole.SUPER_ADMIN] },
            exportDefinition: { roles: [SystemRole.SUPER_ADMIN] },
            exportXlsx: { roles: [SystemRole.SUPER_ADMIN] },
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
