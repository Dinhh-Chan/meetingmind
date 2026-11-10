import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ClientPlatform } from "../common/constant";

export class GoogleLoginDto {
    /** ID token Google Identity Services trả về cho trình duyệt. */
    @IsNotEmpty()
    @IsString()
    credential: string;

    /** Token trong link mời: đăng nhập xong vào luôn workspace được mời. */
    @IsOptional()
    @IsString()
    inviteToken?: string;

    @IsOptional()
    @IsEnum(ClientPlatform)
    platform?: ClientPlatform;
}
