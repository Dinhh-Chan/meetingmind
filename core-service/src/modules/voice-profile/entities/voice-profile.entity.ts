import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

/**
 * Vân giọng đã đăng ký của một người, để nhận ra họ trong bản ghi cuộc họp.
 * Chỉ lưu vector (không lưu âm thanh mẫu); người dùng tự đồng ý và tự xoá được
 * (dữ liệu sinh trắc học — dữ liệu cá nhân nhạy cảm).
 */
export class VoiceProfile implements BaseEntity {
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Người dùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Người dùng", required: true })
    userId: string;

    /**
     * Vân giọng (vector đã chuẩn hoá)
     */
    @IsArray()
    @EntityDefinition.field({ label: "Vân giọng", required: true })
    embedding: number[];

    /**
     * Model tính vân giọng: đổi model thì phải đăng ký lại
     */
    @IsString()
    @EntityDefinition.field({ label: "Model", required: true })
    model: string;

    /**
     * Số mẫu đọc
     */
    @IsNumber()
    @EntityDefinition.field({ label: "Số mẫu", required: true })
    sampleCount: number;

    /**
     * Tổng số giây giọng nói trong các mẫu
     */
    @IsNumber()
    @EntityDefinition.field({ label: "Số giây giọng nói", required: true })
    seconds: number;

    /**
     * Thời điểm người dùng đồng ý lưu vân giọng
     */
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm đồng ý", required: true })
    consentAt: Date;

    @IsOptional()
    @IsDateString()
    updatedAt?: Date;
}
