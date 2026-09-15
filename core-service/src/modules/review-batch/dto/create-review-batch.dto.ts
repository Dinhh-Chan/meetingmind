import { OmitType } from "@nestjs/swagger";
import { ReviewBatch } from "../entities/review-batch.entity";

export class CreateReviewBatchDto extends OmitType(ReviewBatch, ["_id"] as const) {}
