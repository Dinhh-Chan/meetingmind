import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { SystemRole } from "@module/user/common/constant";
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
    constructor(private readonly reviewItemService: ReviewItemService) {
        super(reviewItemService);
    }
}
