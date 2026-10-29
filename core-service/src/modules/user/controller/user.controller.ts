import { RequestAuthData } from "@common/constant/class/request-auth-data";
import { ApiRecordResponse } from "@common/decorator/api.decorator";
import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Body, Controller, Get, Put, Req } from "@nestjs/common";

import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ChangePasswordDto } from "../dto/change-password.dto";
import { User } from "../entities/user.entity";
import { UserService } from "../service/user.service";

@Controller("user")
@ApiTags("user")
export class UserController extends BaseControllerFactory<User>(
    User,
    null,
    null,
    null,
    {
        import: {
            enable: false,
        },
        routes: {
            create: {
                enable: true,
                document: {
                    operator: {
                        summary: "Create a new User",
                        description:
                            "Create a new User record. Throw error if User with the same username existed",
                    },
                    response: { description: "Created User data" },
                },
            },
        },
        dataPartition: {
            enable: true,
        },
        // Không đặt `authorize: false`: trước đây mọi route /user/* gọi được
        // mà không đăng nhập, kể cả danh sách user kèm hash mật khẩu. Route
        // CRUD giờ chỉ dành cho SUPER_ADMIN; tự đăng ký dùng POST /auth/register.
    },
) {
    constructor(private readonly userService: UserService) {
        super(userService);
    }

    // Controller đặt `authorize: false` nên route tự thêm phải tự gắn guard,
    // không thì `req.user` rỗng và getMe lỗi 500.
    @Get("me")
    @Authorization()
    @ApiRecordResponse(User)
    // @UseAuditLog({
    //     action: "getMe",
    //     sourceId: "response.data._id",
    //     description:
    //         "{{uName}} lấy thông tin user của mình (_id: {{response.data._id}})",
    //     logResponse: true,
    // })
    async getMe(@Req() req: Request) {
        const authData = req.user as RequestAuthData;
        return this.userService.getMe(authData);
    }

    @Put("me/password")
    @ApiRecordResponse(User)
    @Authorization()
    async changePasswordMe(@ReqUser() user: User, @Body() dto: ChangePasswordDto) {
        return this.userService.changePasswordMe(user, dto);
    }

    // @Get("test")
    // async test() {
    //     return this.userService.testUser();
    // }
}
