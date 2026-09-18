import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Readable } from "stream";
import { ConfigService } from "@nestjs/config";
import { Configuration } from "src/config/configuration";
import {
    InjectMinioClient,
    InjectMinioPublicClient,
    MinioClient,
} from "./minio.provider";

@Injectable()
export class MinioService implements OnModuleInit {
    private readonly logger: Logger = new Logger(MinioService.name);
    constructor(
        private readonly configService: ConfigService<Configuration>,
        @InjectMinioClient()
        private readonly minioClient: MinioClient,
        @InjectMinioPublicClient()
        private readonly minioPublicClient: MinioClient,
    ) {}
    async onModuleInit() {
        await this.initFileUploadBuckets();
    }

    async initFileUploadBuckets() {
        const { region, bucket } = this.configService.get("minio", {
            infer: true,
        });
        try {
            const exists = await this.minioClient.bucketExists(bucket);
            if (exists) {
                this.logger.warn(`Bucket "${bucket}" initialized`);
            } else {
                await this.minioClient.makeBucket(bucket, region);
                this.logger.verbose(`Bucket "${bucket}" created`);
            }
        } catch (err) {
            this.logger.warn(
                `Error initializing bucket "${bucket}": ${err as string}`,
            );
        }
    }

    /** Bucket mặc định theo cấu hình. */
    getBucket(): string {
        return this.configService.get("minio", { infer: true }).bucket;
    }

    async putObject(
        objectKey: string,
        body: Buffer | Readable,
        size: number,
        mimetype: string,
    ) {
        return this.minioClient.putObject(
            this.getBucket(),
            objectKey,
            body,
            size,
            { "Content-Type": mimetype },
        );
    }

    async statObject(objectKey: string, bucket?: string) {
        return this.minioClient.statObject(bucket || this.getBucket(), objectKey);
    }

    /**
     * URL tạm để tải file. Không lưu URL này vào database — nó hết hạn; chỉ
     * cấp khi người dùng đã được kiểm tra quyền (DATABASE_DESIGN, bảng files).
     */
    async getDownloadUrl(objectKey: string, bucket?: string, expirySeconds = 300) {
        return this.minioPublicClient.presignedGetObject(
            bucket || this.getBucket(),
            objectKey,
            expirySeconds,
        );
    }

    async removeObject(objectKey: string, bucket?: string) {
        return this.minioClient.removeObject(bucket || this.getBucket(), objectKey);
    }
}
