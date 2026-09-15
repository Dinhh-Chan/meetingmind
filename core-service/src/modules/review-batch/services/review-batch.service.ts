import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ReviewBatch } from "../entities/review-batch.entity";
import { ReviewBatchRepository } from "../repositories/review-batch-repository.interface";

@Injectable()
export class ReviewBatchService extends BaseService<ReviewBatch, ReviewBatchRepository> {
    constructor(
        @InjectRepository(Entity.REVIEW_BATCH)
        private readonly reviewBatchRepository: ReviewBatchRepository,
    ) {
        super(reviewBatchRepository);
    }
}
