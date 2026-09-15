import { PartialType } from "@nestjs/swagger";
import { ReviewItem } from "../entities/review-item.entity";

export class ReviewItemConditionDto extends PartialType(ReviewItem) {}
