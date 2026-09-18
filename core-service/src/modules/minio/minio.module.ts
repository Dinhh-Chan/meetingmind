import { Global, Module } from "@nestjs/common";
import { MinioClientProviders } from "./minio.provider";
import { MinioService } from "./minio.service";

@Global()
@Module({
    providers: [MinioService, ...MinioClientProviders],
    exports: [...MinioClientProviders, MinioService],
})
export class MinioModule {}
