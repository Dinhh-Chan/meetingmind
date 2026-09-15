import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ReviewBatch } from "../entities/review-batch.entity";
import { ReviewBatchModel } from "../models/review-batch.model";
import { ReviewBatchRepository } from "./review-batch-repository.interface";

@Injectable()
export class ReviewBatchSqlRepository
    extends SqlRepository<ReviewBatch>
    implements ReviewBatchRepository
{
    constructor(
        @InjectModel(ReviewBatchModel)
        private readonly reviewBatchModel: ModelCtor<ReviewBatchModel>,
    ) {
        super(reviewBatchModel);
    }
}
