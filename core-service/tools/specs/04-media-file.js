/** Bảng `files` theo DATABASE_DESIGN: lưu object key của MinIO, không lưu nội dung. */
const S = (name, opt = {}) => ({ name, type: "string", ...opt });
const T = (name, opt = {}) => ({ name, type: "text", ...opt });
const I = (name, opt = {}) => ({ name, type: "int", ...opt });

module.exports = [
    {
        name: "media-file",
        table: "files",
        softDelete: true,
        enums: {
            MediaFileKind: { AUDIO: "audio", ATTACHMENT: "attachment", EXPORT: "export" },
            MediaFileStatus: {
                UPLOADING: "uploading",
                READY: "ready",
                FAILED: "failed",
                DELETED: "deleted",
            },
        },
        indexes: [
            { fields: ["bucket", "objectKey"], unique: true },
            { fields: ["workspaceId", "meetingId"] },
        ],
        fields: [
            { name: "workspaceId", type: "string", required: true, label: "Workspace" },
            S("meetingId", { label: "Cuộc họp" }),
            S("botSessionId", { label: "Phiên bot" }),
            S("kind", { required: true, label: "Loại file", enum: "MediaFileKind" }),
            S("bucket", { required: true, label: "Bucket" }),
            T("objectKey", { required: true, label: "Object key trong MinIO" }),
            S("mimetype", { required: true, label: "MIME type" }),
            I("sizeBytes", { required: true, label: "Kích thước (byte)" }),
            I("durationMs", { label: "Thời lượng (ms), với audio" }),
            S("checksum", { label: "sha256, dùng chống trùng" }),
            S("status", { required: true, label: "Trạng thái", enum: "MediaFileStatus" }),
            S("uploadedById", { label: "Người tải lên" }),
        ],
    },
];
