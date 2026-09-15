import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ReviewItem } from "../entities/review-item.entity";
import { ReviewItemRepository } from "../repositories/review-item-repository.interface";

@Injectable()
export class ReviewItemService extends BaseService<ReviewItem, ReviewItemRepository> {
    constructor(
        @InjectRepository(Entity.REVIEW_ITEM)
        private readonly reviewItemRepository: ReviewItemRepository,
    ) {
        super(reviewItemRepository);
    }
}
