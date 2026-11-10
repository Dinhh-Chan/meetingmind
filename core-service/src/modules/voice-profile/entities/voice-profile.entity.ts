import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { VoiceProfileStatus, VoiceQuality } from "../common/constant";

/**
 * Vân giọng đã đăng ký của một người, để nhận ra họ trong bản ghi cuộc họp.
 * Lưu vector và các mẫu đọc (để admin nghe khi xác nhận); người dùng tự đồng
 * ý và tự xoá được (dữ liệu sinh trắc học — dữ liệu cá nhân nhạy cảm).
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

    /**
     * Trạng thái xác nhận của admin; trống là bản đăng ký trước khi có bước
     * xác nhận (coi như đã xác nhận)
     */
    @IsOptional()
    @IsEnum(VoiceProfileStatus)
    @EntityDefinition.field({ label: "Trạng thái", enum: Object.values(VoiceProfileStatus) })
    status?: VoiceProfileStatus;

    /**
     * Chất lượng mẫu
     */
    @IsOptional()
    @IsEnum(VoiceQuality)
    @EntityDefinition.field({ label: "Chất lượng", enum: Object.values(VoiceQuality) })
    quality?: VoiceQuality;

    /**
     * Object key các mẫu đọc trong MinIO, để admin nghe khi xác nhận
     */
    @IsOptional()
    @IsArray()
    @EntityDefinition.field({ label: "Mẫu đọc" })
    sampleKeys?: string[];

    /**
     * MIME type của mẫu đọc
     */
    @IsOptional()
    @IsString()
    @EntityDefinition.field({ label: "MIME type mẫu" })
    sampleMimetype?: string;

    /**
     * Người xác nhận / từ chối
     */
    @IsOptional()
    @IsString()
    @EntityDefinition.field({ label: "Người xác nhận" })
    reviewedById?: string;

    /**
     * Thời điểm xác nhận / từ chối
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xác nhận" })
    reviewedAt?: Date;

    @IsOptional()
    @IsDateString()
    updatedAt?: Date;
}
