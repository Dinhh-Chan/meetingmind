import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { ClarificationStatus } from "../common/constant";

/**
 * Yêu cầu làm rõ một đề xuất AI trước khi duyệt thành task: người duyệt hỏi
 * (thiếu người thực hiện, hạn mơ hồ…), người được hỏi trả lời.
 */
export class ClarificationRequest implements BaseEntity {
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Workspace
     */
    @IsString()
    @EntityDefinition.field({ label: "Workspace", required: true })
    workspaceId: string;

    /**
     * Cuộc họp của đề xuất
     */
    @IsString()
    @EntityDefinition.field({ label: "Cuộc họp", required: true })
    meetingId: string;

    /**
     * Đề xuất cần làm rõ
     */
    @IsString()
    @EntityDefinition.field({ label: "Đề xuất", required: true })
    reviewItemId: string;

    /**
     * Người hỏi
     */
    @IsString()
    @EntityDefinition.field({ label: "Người hỏi", required: true })
    askedById: string;

    /**
     * Người được hỏi
     */
    @IsString()
    @EntityDefinition.field({ label: "Người được hỏi", required: true })
    recipientId: string;

    /**
     * Nội dung cần làm rõ
     */
    @IsString()
    @EntityDefinition.field({ label: "Nội dung cần làm rõ", required: true })
    question: string;

    /**
     * Trạng thái
     */
    @IsEnum(ClarificationStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(ClarificationStatus) })
    status: ClarificationStatus;

    /**
     * Câu trả lời
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Câu trả lời" })
    answer?: string;

    /**
     * Thời điểm trả lời
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm trả lời" })
    answeredAt?: Date;
}
