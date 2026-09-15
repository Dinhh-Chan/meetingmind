import { SequelizeModel } from "@module/repository/sequelize/common/sequelize-model";
import { Global, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";

/**
 * Đăng ký toàn bộ model Sequelize ở một chỗ. Module này là @Global nên
 * các module nghiệp vụ không cần tự khai SequelizeModule.forFeature.
 */
const SequelizeFeature = SequelizeModule.forFeature(SequelizeModel);

@Global()
@Module({
    imports: [SequelizeFeature],
    exports: [SequelizeFeature],
})
export class RepositoryModule {}
