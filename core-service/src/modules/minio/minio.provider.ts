import { Inject, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";
import { Configuration } from "../../config/configuration";

const MINIO_CLIENT = "MINIO_CLIENT";
const MINIO_PUBLIC_CLIENT = "MINIO_PUBLIC_CLIENT";
export const InjectMinioClient = () => Inject(MINIO_CLIENT);
/** Client chỉ dùng để ký URL cho trình duyệt — không dùng để đọc/ghi object. */
export const InjectMinioPublicClient = () => Inject(MINIO_PUBLIC_CLIENT);
export type MinioClient = Client;

export const MinioClientProviders: Provider[] = [
    {
        provide: MINIO_CLIENT,
        useFactory: async (configService: ConfigService<Configuration>) => {
            const {
                endPoint,
                port,
                useSsl: useSSL,
                accessKey,
                secretKey,
                region,
            } = configService.get("minio", { infer: true });
            const client = new Client({
                endPoint,
                port,
                useSSL,
                accessKey,
                secretKey,
                region,
            });
            return client;
        },
        inject: [ConfigService],
    },
    {
        provide: MINIO_PUBLIC_CLIENT,
        useFactory: async (configService: ConfigService<Configuration>) => {
            const {
                publicEndPoint,
                publicPort,
                publicUseSsl,
                accessKey,
                secretKey,
                region,
            } = configService.get("minio", { infer: true });
            return new Client({
                endPoint: publicEndPoint,
                port: publicPort,
                useSSL: publicUseSsl,
                accessKey,
                secretKey,
                region,
            });
        },
        inject: [ConfigService],
    },
];
