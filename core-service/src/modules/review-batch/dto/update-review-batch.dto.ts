import { PartialType } from "@nestjs/swagger";
import { CreateReviewBatchDto } from "./create-review-batch.dto";

export class UpdateReviewBatchDto extends PartialType(CreateReviewBatchDto) {}
