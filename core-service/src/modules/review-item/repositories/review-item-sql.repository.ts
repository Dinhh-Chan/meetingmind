import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ReviewItem } from "../entities/review-item.entity";
import { ReviewItemModel } from "../models/review-item.model";
import { ReviewItemRepository } from "./review-item-repository.interface";

@Injectable()
export class ReviewItemSqlRepository
    extends SqlRepository<ReviewItem>
    implements ReviewItemRepository
{
    constructor(
        @InjectModel(ReviewItemModel)
        private readonly reviewItemModel: ModelCtor<ReviewItemModel>,
    ) {
        super(reviewItemModel);
    }
}
