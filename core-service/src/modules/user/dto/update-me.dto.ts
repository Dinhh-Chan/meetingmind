import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Người dùng tự sửa hồ sơ ở Cài đặt › Tài khoản. Email là tên đăng nhập nên không đổi ở đây. */
export class UpdateMeDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    fullname?: string;

    /** Múi giờ IANA, ví dụ Asia/Ho_Chi_Minh */
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timezone?: string;

    @IsOptional()
    @IsIn(["vi", "en"])
    language?: string;
}
