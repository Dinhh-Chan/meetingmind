import { PartialType } from "@nestjs/swagger";
import { CreateActionItemHistoryDto } from "./create-action-item-history.dto";

export class UpdateActionItemHistoryDto extends PartialType(CreateActionItemHistoryDto) {}
