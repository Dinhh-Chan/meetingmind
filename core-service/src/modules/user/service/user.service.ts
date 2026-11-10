import { createUserPassword } from "@common/constant";
import { RequestAuthData } from "@common/constant/class/request-auth-data";
import { Configuration } from "@config/configuration";
import { ApiError } from "@config/exception/api-error";
import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { BaseTransaction } from "@module/repository/common/base-transaction.interface";
import { InjectRepository } from "@module/repository/common/repository";
import { InjectTransaction } from "@module/repository/common/transaction";
import { SettingKey } from "@module/setting/common/constant";
import { SettingService } from "@module/setting/setting.service";
import { CreateUserDto } from "@module/user/dto/create-user.dto";
import { UserRepository } from "@module/user/repository/user-repository.interface";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { SystemRole } from "../common/constant";
import { ChangePasswordDto } from "../dto/change-password.dto";
import { UpdateMeDto } from "../dto/update-me.dto";
import { User } from "../entities/user.entity";

@Injectable()
export class UserService
    extends BaseService<User, UserRepository>
    implements OnApplicationBootstrap
{
    constructor(
        @InjectRepository(Entity.USER)
        private readonly userRepository: UserRepository,
        private readonly settingService: SettingService,
        private readonly configService: ConfigService<Configuration>,
        @InjectTransaction()
        private readonly userTransaction: BaseTransaction,
    ) {
        super(userRepository, {
            notFoundCode: "error-user-not-found",
            transaction: userTransaction,
        });
    }

    async testUser() {
        await this.userRepository.distinct("", { asd: 1 });
        const user = await this.userRepository.updateOne(
            {
                username: "admin",
            },
            {
                $inc: { __v: -1 },
                fullname: 1,
            },
        );
        return user;
    }

    async onApplicationBootstrap() {
        const setting = await this.settingService.getSettingValue(
            SettingKey.INIT_DATA,
        );
        const update = setting || {};
        if (!update.isAdminCreated) {
            update.isAdminCreated = true;
            const { defaultAdminUsername, defaultAdminPassword } =
                this.configService.get("server", {
                    infer: true,
                });
            await this.userRepository.create({
                username: defaultAdminUsername,
                email: "admin@administrator.com",
                password: await createUserPassword(defaultAdminPassword),
                systemRole: SystemRole.SUPER_ADMIN,
                fullname: "Administrator",
            });
            Logger.verbose("Admin created");
            await this.settingService.setSettingValue(
                SettingKey.INIT_DATA,
                update,
            );
        }
    }

    async internalGetById(id: string) {
        return this.userRepository.getById(id, { enableDataPartition: false });
    }

    async getMe(authData: RequestAuthData) {
        // hasPassword: giao diện biết để hỏi "mật khẩu hiện tại" hay cho đặt mật khẩu lần đầu.
        const user = await authData.getUser();
        return { ...withoutPassword(user), hasPassword: !!user?.password };
    }

    /** Tự đăng ký: luôn là tài khoản thường, không nhận systemRole từ client. */
    async register(dto: {
        username: string;
        email: string;
        fullname: string;
        password: string;
    }) {
        const username = dto.username.trim().toLowerCase();
        const email = dto.email.trim().toLowerCase();
        const [byName] = await this.userRepository.getMany(
            { username },
            { enableDataPartition: false },
        );
        const [byEmail] = await this.userRepository.getMany(
            { email },
            { enableDataPartition: false },
        );
        if (byName || byEmail) {
            throw ApiError.BadRequest("error-user-exist");
        }
        const user = await this.create(null, {
            username,
            email,
            fullname: dto.fullname.trim(),
            password: dto.password,
            systemRole: SystemRole.USER,
        } as CreateUserDto);
        return withoutPassword(user);
    }

    async create(user: User, dto: CreateUserDto): Promise<User> {
        if (dto.password) {
            dto.password = await createUserPassword(dto.password);
        }
        const t = await this.userTransaction.startTransaction();
        try {
            const res = await this.userRepository.create(dto, {
                transaction: t,
            });
            await this.userTransaction.commitTransaction(t);
            return res;
        } catch (err) {
            await this.userTransaction.abortTransaction(t);
            throw err;
        }
    }

    /** Tự sửa họ tên, múi giờ, ngôn ngữ. */
    async updateMe(user: User, dto: UpdateMeDto) {
        const patch: Partial<User> = {};
        if (dto.fullname !== undefined) {
            const fullname = dto.fullname.trim();
            if (!fullname) throw ApiError.BadRequest("error-fullname-required");
            patch.fullname = fullname;
        }
        if (dto.timezone !== undefined) {
            try {
                new Intl.DateTimeFormat("en", { timeZone: dto.timezone });
            } catch {
                throw ApiError.BadRequest("error-timezone-invalid");
            }
            patch.timezone = dto.timezone;
        }
        if (dto.language !== undefined) patch.language = dto.language;
        const res = await this.userRepository.updateById(user._id, patch);
        return { ...withoutPassword(res), hasPassword: !!res?.password };
    }

    async changePasswordMe(user: User, dto: ChangePasswordDto) {
        // Lấy lại từ DB để chắc có hash mật khẩu hiện tại.
        const current = await this.userRepository.getById(user._id, {
            enableDataPartition: false,
        });
        if (!current) throw ApiError.BadRequest("error-old-password-wrong");
        // Tài khoản tạo bằng Google chưa có mật khẩu: đặt lần đầu không cần mật khẩu cũ.
        const firstPassword = !current.password;
        if (!firstPassword && !(await this.comparePassword(current, dto.oldPass ?? ""))) {
            throw ApiError.BadRequest("error-old-password-wrong");
        }
        if (!firstPassword && dto.oldPass === dto.newPass) {
            throw ApiError.BadRequest("error-duplicate-new-password");
        }
        // Trước đây ghi `dto.oldPass` dạng chữ thường vào cột password.
        const res = await this.userRepository.updateById(current._id, {
            password: await createUserPassword(dto.newPass),
        });
        return withoutPassword(res);
    }

    async comparePassword(user: User, password: string) {
        return bcrypt.compare(password, user.password);
    }
}

/** Không trả hash mật khẩu ra ngoài. */
function withoutPassword<T extends { password?: string }>(user: T | null) {
    if (!user) return user;
    const plain = { ...((user as { toJSON?: () => T }).toJSON?.() ?? user) };
    delete plain.password;
    return plain;
}
