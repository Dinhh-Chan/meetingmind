/** Thiết kế còn jira, slack, notion... — thêm vào khi làm tới. */
export enum IntegrationProvider {
    TRELLO = "trello",
    TELEGRAM = "telegram",
}

export enum IntegrationStatus {
    CONNECTED = "connected",
    DISCONNECTED = "disconnected",
    ERROR = "error",
}

/**
 * MVP: mỗi nhà cung cấp một kết nối, đọc từ biến môi trường, dùng chung cho
 * mọi workspace. Khi có màn hình kết nối theo workspace thì mỗi workspace một
 * dòng riêng với workspaceId thật.
 */
export const ENV_WORKSPACE_ID = "*";
export const ENV_EXTERNAL_ACCOUNT_ID = "env";
