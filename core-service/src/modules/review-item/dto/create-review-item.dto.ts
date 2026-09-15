import { OmitType } from "@nestjs/swagger";
import { ReviewItem } from "../entities/review-item.entity";

export class CreateReviewItemDto extends OmitType(ReviewItem, ["_id"] as const) {}
