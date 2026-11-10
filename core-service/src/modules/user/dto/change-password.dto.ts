import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ChangePasswordDto {
    /** Bỏ trống khi tài khoản (tạo bằng Google) đặt mật khẩu lần đầu. */
    @IsOptional()
    @IsString()
    oldPass?: string;

    @IsNotEmpty()
    @IsString()
    newPass: string;
}
