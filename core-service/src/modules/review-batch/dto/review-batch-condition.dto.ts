import { PartialType } from "@nestjs/swagger";
import { ReviewBatch } from "../entities/review-batch.entity";

export class ReviewBatchConditionDto extends PartialType(ReviewBatch) {}
