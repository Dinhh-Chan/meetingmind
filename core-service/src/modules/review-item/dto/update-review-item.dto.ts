import { PartialType } from "@nestjs/swagger";
import { CreateReviewItemDto } from "./create-review-item.dto";

export class UpdateReviewItemDto extends PartialType(CreateReviewItemDto) {}
