# MeetingMind — Database Design (MVP)

PostgreSQL là nguồn dữ liệu chính. Thiết kế bám theo codebase NestJS/Sequelize hiện có và nguyên tắc sở hữu dữ liệu trong [ARCHITECTURE.md](ARCHITECTURE.md).

## Nguyên tắc chung

- Primary key dùng `_id` dạng `string` để khớp `StrObjectId()` hiện có.
- **Mọi bảng đều có `createdAt`, `updatedAt`** (Sequelize `timestamps: true`). Tài liệu này không lặp lại hai cột đó ở từng bảng; chỉ ghi chú khi có ngoại lệ (ví dụ bảng chỉ có `createdAt`).
- Bảng nghiệp vụ có `workspaceId` để tách dữ liệu theo workspace. `users`, `oauth_accounts` là danh tính toàn hệ thống nên **không** có `workspaceId`.
- Dùng `deletedAt` cho soft delete ở dữ liệu người dùng tạo (Sequelize `paranoid: true`).
- Trạng thái khai báo enum trong code, cột DB dùng `STRING` để dễ migration giai đoạn MVP.
- Transcript, citation, embedding là điểm khác biệt của MeetingMind nên phải lưu đủ quan hệ tới meeting, **phiên bản** và timestamp.

### Nguyên tắc sở hữu dữ liệu

- Mỗi bảng có **đúng một service** được ghi.
- Service khác lấy dữ liệu qua API hoặc event, không truy vấn trực tiếp.
- **Foreign key chỉ dùng trong phạm vi schema của một service.** ID trỏ sang service khác là tham chiếu logic, đánh dấu *(ref ngoài)* trong bảng.
- Ràng buộc kết hợp dùng để chống lẫn workspace: ví dụ `(workspaceId, projectId)` tham chiếu `(workspaceId, _id)` của `projects`, để task của workspace A không trỏ được sang project của workspace B.

### Phân chia schema

| Schema | Tài khoản | Service sở hữu |
| --- | --- | --- |
| `core` | `mm_core` | core-service (api-gateway chỉ đọc qua Core) |
| `integration` | `mm_integration` | integration-service |
| `ai` | `mm_ai` | ai-service |

Image Postgres phải có pgvector (`pgvector/pgvector:pg15`). Tắt `synchronize`/`sync.alter`, mỗi service tự quản migration.

---

# Schema `core`

## Nhóm Identity

### users

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `email` | string | yes | unique |
| `username` | string | no | unique nếu dùng login nội bộ |
| `passwordHash` | string | no | null nếu chỉ SSO. Đổi tên từ `password` để phản ánh đúng dữ liệu lưu |
| `fullName` | string | no |  |
| `avatarUrl` | string | no |  |
| `systemRole` | string | yes | `SUPER_ADMIN`, `USER` |
| `lastLoginAt` | datetime | no |  |
| `deletedAt` | datetime | no |  |

> Tên bảng `users` hiện đang bị `ai-service` chiếm trong schema `public`. Sau khi tách schema, bảng này nằm ở `core.users`, không còn xung đột.

### oauth_accounts

Danh tính SSO Google/Microsoft **chỉ phục vụ đăng nhập**. Token truy cập Calendar/Docs không lưu ở đây mà ở `integration.integrations`.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `userId` | string | yes | FK `users._id` |
| `provider` | string | yes | `google`, `microsoft` |
| `providerAccountId` | string | yes | ID từ provider |
| `email` | string | yes |  |
| `deletedAt` | datetime | no |  |

Index: unique `(provider, providerAccountId)`, index `userId`.

> Đăng nhập bằng Google **không** đồng nghĩa đã cấp quyền đọc Calendar.

### user_sessions

Quản lý refresh token để thu hồi được phiên đăng nhập.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `userId` | string | yes | FK `users._id` |
| `refreshTokenHash` | string | yes | không lưu token thô |
| `userAgent` | string | no |  |
| `ipAddress` | string | no |  |
| `expiresAt` | datetime | yes |  |
| `revokedAt` | datetime | no |  |

Index: `(userId, expiresAt)`.

## Nhóm Workspace

### workspaces

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `name` | string | yes |  |
| `slug` | string | yes | unique |
| `ownerId` | string | yes | FK `users._id` |
| `plan` | string | yes | `free`, `pro`, `business` |
| `timezone` | string | yes | ví dụ `Asia/Ho_Chi_Minh` |
| `deletedAt` | datetime | no |  |

### workspace_members

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `userId` | string | yes | FK `users._id` |
| `role` | string | yes | `OWNER`, `PM`, `MEMBER`, `VIEWER` |
| `status` | string | yes | `active`, `invited`, `disabled` |
| `joinedAt` | datetime | no |  |

Index: unique `(workspaceId, userId)`.

### workspace_settings

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `minutesTemplate` | jsonb | no | mẫu biên bản |
| `reminderRules` | jsonb | no | nhắc deadline |
| `audioRetentionDays` | integer | yes |  |
| `transcriptRetentionDays` | integer | no |  |
| `autoJoinEnabled` | boolean | yes |  |
| `autoSyncEnabled` | boolean | yes | chỉ đồng bộ task đã duyệt khi bật |

Index: unique `workspaceId`.

## Nhóm Project

### projects

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `name` | string | yes |  |
| `description` | text | no |  |
| `status` | string | yes | `active`, `archived` |
| `createdById` | string | yes | FK `users._id` |
| `deletedAt` | datetime | no |  |

Index: unique `(workspaceId, _id)` để làm đích cho ràng buộc kết hợp.

### project_members

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | yes | FK `projects._id` |
| `userId` | string | yes | FK `users._id` |
| `role` | string | yes | **Quyền**: `PM`, `MEMBER`, `VIEWER` |
| `discipline` | string | no | **Vai trò chuyên môn**: `BACKEND`, `FRONTEND`, `QA`, `BA`, `DESIGN`, `CLIENT` |

Index: unique `(projectId, userId)`; FK kết hợp `(workspaceId, projectId)` → `projects (workspaceId, _id)`.

> `role` và `discipline` là hai trục khác nhau. AI có thể gợi ý `discipline`, nhưng không bao giờ được sửa `role`.

## Nhóm Meeting

### meetings

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `sourceType` | string | yes | **mới** — `meeting_link`, `in_person`, `upload` |
| `meetingUrl` | text | **no** | chỉ bắt buộc khi `sourceType = meeting_link` |
| `platform` | string | **no** | `google_meet`, `teams`, `zoom`, `other`; null với `in_person`/`upload` |
| `language` | string | yes | `vi`, `en`, ... |
| `visibility` | string | yes | **mới** — `project`, `participants`, `private` |
| `status` | string | yes | **mới** — `scheduled`, `in_progress`, `ended`, `cancelled` |
| `scheduledStartAt` | datetime | **no** | null với nguồn `upload` |
| `scheduledEndAt` | datetime | no |  |
| `actualStartAt` | datetime | no |  |
| `actualEndAt` | datetime | no |  |
| `processingStatus` | string | no | tổng hợp để hiển thị nhanh; nguồn sự thật là `processing_jobs` |
| `createdById` | string | yes | FK `users._id` |
| `deletedAt` | datetime | no |  |

Index: `(workspaceId, scheduledStartAt)`, `(workspaceId, projectId)`, `(workspaceId, status)`; unique `(workspaceId, _id)`.

Thay đổi so với bản trước:

- Bỏ `botStatus` — trạng thái bot thuộc `bot_sessions`, một meeting có thể có nhiều lần chạy bot.
- Bỏ `audioFileId` — quan hệ file là một-nhiều, chuyển sang `files.meetingId`.
- `meetingUrl`, `platform`, `scheduledStartAt` chuyển thành nullable. **Bản cũ bắt buộc ba cột này nên không lưu được cuộc họp trực tiếp và file upload — chính là hai nguồn chính của MVP.**
- Thêm `visibility` để RAG và API có căn cứ lọc quyền.

### meeting_participants

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `userId` | string | no | FK `users._id`; null nếu là khách chưa có tài khoản |
| `displayName` | string | yes |  |
| `email` | string | no |  |
| `role` | string | no | `host`, `secretary`, `presenter`, `approver`, `participant`, `bot` |

Index: `(meetingId)`, `(workspaceId, userId)`.

### agenda_items

**Mới.** Note gắn với mục agenda (6.7), biên bản dựng theo agenda (6.8), task tồn đưa vào agenda kỳ sau (6.10).

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `sequence` | integer | yes | thứ tự trong cuộc họp |
| `plannedMinutes` | integer | no |  |
| `carriedFromActionItemId` | string | no | FK `action_items._id` nếu là việc tồn kỳ trước |

Index: unique `(meetingId, sequence)`.

### recording_consents

**Mới.** §6.2 và §10 yêu cầu ghi nhận xác nhận ghi âm — đây là yêu cầu pháp lý, cần lưu vết.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `participantId` | string | no | FK `meeting_participants._id` |
| `method` | string | yes | `announced`, `explicit_click`, `platform_notice` |
| `granted` | boolean | yes |  |
| `notifiedAt` | datetime | yes |  |
| `evidence` | jsonb | no | ảnh chụp thông báo, nội dung câu thông báo |

Index: `(meetingId)`.

## Files & Recording

### files

**Cần sửa module có sẵn.** Bảng `File` đã tồn tại trong template nhưng lưu nội dung file vào cột `data: TEXT` (`FileStorageType = Database | S3`). Lưu audio 60 phút dạng base64 trong Postgres là không dùng được — phải chuyển sang lưu object key.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `botSessionId` | string | no | FK `bot_sessions._id` |
| `kind` | string | yes | `audio`, `attachment`, `export` |
| `bucket` | string | yes | MinIO bucket |
| `objectKey` | text | yes | **không lưu presigned URL** — cấp URL lúc người dùng có quyền truy cập |
| `mimetype` | string | yes |  |
| `sizeBytes` | bigint | yes |  |
| `durationMs` | integer | no | với audio |
| `checksum` | string | no | sha256, dùng để dedup |
| `status` | string | yes | `uploading`, `ready`, `failed`, `deleted` |
| `uploadedById` | string | no | FK `users._id` |
| `deletedAt` | datetime | no |  |

Index: `(workspaceId, meetingId)`, `(bucket, objectKey)` unique.

### upload_sessions

**Mới.** §6.4: ghi âm khi mất mạng, tải lên khi kết nối phục hồi, tải lên nhiều phần có thể tiếp tục.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `fileId` | string | no | FK `files._id`, gán khi hoàn tất |
| `uploadId` | string | yes | multipart upload ID của MinIO |
| `totalParts` | integer | no |  |
| `completedParts` | jsonb | yes | danh sách `{partNumber, etag}` |
| `clientRecordingId` | string | yes | ID sinh ở thiết bị, dùng chống trùng khi retry |
| `status` | string | yes | `open`, `completed`, `aborted`, `expired` |
| `expiresAt` | datetime | yes |  |

Index: unique `(workspaceId, clientRecordingId)`.

### recording_segments

**Mới.** §6.4: "lưu từng phần bản ghi và báo rõ đoạn bị gián đoạn".

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `fileId` | string | yes | FK `files._id` |
| `sequence` | integer | yes | thứ tự đoạn |
| `startOffsetMs` | integer | yes | mốc so với đầu cuộc họp |
| `durationMs` | integer | yes |  |
| `hasGapBefore` | boolean | yes | true nếu gián đoạn trước đoạn này |
| `gapReason` | string | no | `network_lost`, `paused_by_user`, `device_error` |

Index: unique `(meetingId, sequence)`.

### bot_sessions

Một lần bot vào phòng họp. Một meeting có thể có nhiều session (thử lại).

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `status` | string | yes | `queued`, `joining`, `waiting_admission`, `recording`, `left`, `failed`, `cancelled` |
| `joinUrl` | text | yes |  |
| `attempt` | integer | yes | default 1 |
| `startedAt` | datetime | no |  |
| `endedAt` | datetime | no |  |
| `heartbeatAt` | datetime | no | phát hiện session treo |
| `error` | text | no |  |

Index: `(meetingId, attempt)` unique, `(workspaceId, status)`.

## Transcript

### transcript_versions

**Mới.** Sửa transcript hoặc chạy lại AI phải tạo phiên bản mới, không ghi đè. Không có bảng này thì citation của task đã duyệt bị đổi nghĩa âm thầm — đúng điều §12 cấm.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `versionNo` | integer | yes | tăng dần trong meeting |
| `source` | string | yes | `stt`, `manual_edit`, `rerun` |
| `aiRunId` | string | no | *(ref ngoài)* `ai.ai_runs._id` |
| `createdById` | string | no | FK `users._id` nếu do người sửa |
| `isCurrent` | boolean | yes | đúng một bản `true` mỗi meeting |

Index: unique `(meetingId, versionNo)`; unique một phần `(meetingId)` với `isCurrent = true`.

### transcript_segments

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `transcriptVersionId` | string | yes | **mới** — FK `transcript_versions._id` |
| `speakerLabel` | string | yes | `Speaker 1` |
| `speakerUserId` | string | no | FK `users._id` sau khi xác nhận |
| `identityStatus` | string | yes | **mới** — `unknown`, `suggested`, `confirmed` |
| `startMs` | integer | yes |  |
| `endMs` | integer | yes |  |
| `text` | text | yes | nội dung hiện tại |
| `rawText` | text | no | nội dung gốc từ STT |
| `confidence` | decimal | no |  |
| `isOverlapping` | boolean | no | **mới** — đánh dấu nói chồng (§6.5) |
| `sequence` | integer | yes |  |

Index: unique `(transcriptVersionId, sequence)`, `(meetingId, startMs)`, full-text index cho `text`.

> `identityStatus` bảo đảm nguyên tắc §6.5: không đủ căn cứ thì giữ "Chưa xác định", không ép gán người.

### speaker_aliases

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `transcriptVersionId` | string | yes | **mới** |
| `speakerLabel` | string | yes |  |
| `displayName` | string | yes |  |
| `userId` | string | no | FK `users._id` |
| `confirmedById` | string | no | FK `users._id` — ai xác nhận |
| `confirmedAt` | datetime | no |  |

Index: unique `(transcriptVersionId, speakerLabel)`.

## Notes

### notes

**Mới.** §6.7 là tính năng MVP lõi nhưng bản thiết kế cũ không có bảng nào.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `agendaItemId` | string | no | FK `agenda_items._id` |
| `authorId` | string | yes | FK `users._id` |
| `type` | string | yes | `info`, `question`, `idea`, `decision`, `action`, `clarify` |
| `visibility` | string | yes | `private`, `shared` — note riêng **không** vào biên bản chung trừ khi chủ sở hữu cho phép |
| `sharedAt` | datetime | no | thời điểm chủ sở hữu chuyển sang `shared` |
| `body` | text | yes |  |
| `checklist` | jsonb | no |  |
| `tags` | jsonb | no |  |
| `recordingMs` | integer | no | mốc thời gian trong bản ghi, để bấm vào nghe lại |
| `transcriptSegmentId` | string | no | FK nếu note tạo từ một đoạn transcript |
| `deletedAt` | datetime | no |  |

Index: `(meetingId, recordingMs)`, `(workspaceId, authorId)`, `(meetingId, visibility)`.

## Minutes & Decisions

### meeting_minutes

Đại diện biên bản của một cuộc họp; nội dung nằm ở `minutes_versions`.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `currentVersionId` | string | no | FK `minutes_versions._id` |
| `approvedVersionId` | string | no | FK `minutes_versions._id` |

Index: unique `meetingId`.

### minutes_versions

**Mới.** Bản cũ đặt unique trên `meetingId` nên chỉ có một biên bản/họp — mâu thuẫn với §6.8 "tạo lại biên bản từ transcript đã sửa; lưu phiên bản để tránh mất nội dung duyệt trước đó".

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingMinutesId` | string | yes | FK `meeting_minutes._id` |
| `versionNo` | integer | yes |  |
| `summary` | text | yes |  |
| `openIssues` | jsonb | yes |  |
| `editorContent` | jsonb | no |  |
| `templateKey` | string | no | `progress`, `planning`, `client`, `retro` |
| `status` | string | yes | `draft`, `pending_approval`, `approved` |
| `sourceTranscriptVersionId` | string | no | FK `transcript_versions._id` |
| `aiRunId` | string | no | *(ref ngoài)* |
| `approvedById` | string | no | FK `users._id` |
| `approvedAt` | datetime | no |  |

Index: unique `(meetingMinutesId, versionNo)`.

> Bỏ trạng thái `exported`: một biên bản đã duyệt có thể xuất nhiều lần. Lịch sử xuất nằm ở `sync_jobs` bên Integration.

### decisions

**Mới.** Bản cũ nhét quyết định vào `meeting_minutes.decisions` (jsonb). RAG (§6.12) phải trích dẫn được quyết định và `review_items.type` đã có `decision` → cần `_id` thật để tham chiếu.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `agendaItemId` | string | no | FK `agenda_items._id` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `decidedById` | string | no | FK `users._id` |
| `status` | string | yes | `proposed`, `agreed`, `superseded` |
| `supersededByDecisionId` | string | no | FK `decisions._id` — khi họp sau thay đổi quyết định trước |
| `source` | string | yes | `ai`, `manual` |
| `reviewItemId` | string | no | FK `review_items._id` |
| `deletedAt` | datetime | no |  |

Index: `(workspaceId, meetingId)`, `(workspaceId, status)`.

### decision_citations

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `decisionId` | string | yes | FK `decisions._id` |
| `transcriptSegmentId` | string | no | FK `transcript_segments._id` |
| `noteId` | string | no | FK `notes._id` |
| `transcriptVersionId` | string | no | FK — phiên bản đã dùng lúc duyệt |
| `startMs` | integer | no |  |
| `endMs` | integer | no |  |
| `quote` | text | yes |  |

## Action Items & Task Board

### action_items

Task **chính thức**, chỉ sinh ra sau khi duyệt hoặc do người dùng tạo tay.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `reviewItemId` | string | no | FK `review_items._id` nếu sinh từ đề xuất AI |
| `title` | string | yes |  |
| `description` | text | no |  |
| `proposerId` | string | no | **mới** — người đề xuất/giao việc (§6.9) |
| `assigneeId` | string | no | có thể để trống nếu chưa xác định |
| `approverId` | string | no | **mới** — người duyệt kết quả |
| `deadline` | datetime | no |  |
| `deadlineRawText` | string | no | **mới** — giữ câu gốc "thứ Sáu" (§6.9, §12) |
| `deadlineNeedsConfirm` | boolean | yes | **mới** — true khi diễn đạt mơ hồ |
| `priority` | string | yes | `low`, `medium`, `high`, `urgent` |
| `status` | string | yes | `todo`, `in_progress`, `blocked`, `done` |
| `definitionOfDone` | text | no | **mới** — điều kiện hoàn thành (§6.9) |
| `source` | string | yes | `ai`, `manual`, `jira`, `trello` |
| `confidence` | decimal | no | nếu do AI sinh |
| `needsReviewReason` | string | no | **mới** — ví dụ `speaker_changed` khi người nói bị sửa lại (§6.5) |
| `createdById` | string | no | FK `users._id` |
| `deletedAt` | datetime | no |  |

Index: `(workspaceId, status)`, `(workspaceId, assigneeId)`, `(workspaceId, deadline)`, `(workspaceId, projectId)`; unique `reviewItemId` (chống duyệt hai lần sinh hai task).

Thay đổi so với bản trước:

- **Bỏ `reviewStatus`, `approvedById`, `approvedAt`.** Trạng thái duyệt thuộc `review_items`; `action_items` chỉ tồn tại khi đã duyệt.
- Thêm các trường §6.9 mà bản cũ thiếu: người đề xuất, người duyệt, điều kiện hoàn thành, câu gốc của deadline.

### task_dependencies

**Mới.** `risk_flags.type = blocked_dependency` cần dữ liệu quan hệ phụ thuộc, bản cũ không có.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` — việc bị chặn |
| `dependsOnActionItemId` | string | yes | FK `action_items._id` — việc phải xong trước |
| `note` | text | no |  |

Index: unique `(actionItemId, dependsOnActionItemId)`.

### action_item_citations

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `sourceType` | string | yes | **mới** — `transcript`, `note` |
| `transcriptSegmentId` | string | no | FK `transcript_segments._id` |
| `transcriptVersionId` | string | no | **mới** — phiên bản đã dùng lúc duyệt |
| `noteId` | string | no | FK `notes._id` |
| `startMs` | integer | no |  |
| `endMs` | integer | no |  |
| `quote` | text | yes |  |

Index: `(actionItemId)`, `(meetingId, startMs)`.

### action_item_comments

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `authorId` | string | yes | FK `users._id` |
| `body` | text | yes |  |
| `deletedAt` | datetime | no |  |

### action_item_history

Chỉ có `createdAt`, không có `updatedAt`.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `actorId` | string | no | FK `users._id`; null nếu do hệ thống |
| `field` | string | yes | `status`, `deadline`, `assigneeId`, ... |
| `oldValue` | jsonb | no |  |
| `newValue` | jsonb | no |  |

## Review Queue

### review_batches

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `status` | string | yes | `pending`, `in_review`, `completed` |
| `sourceTranscriptVersionId` | string | no | **mới** — FK |
| `aiRunId` | string | no | **mới** — *(ref ngoài)* |
| `reviewerId` | string | no | FK `users._id` |
| `reviewedAt` | datetime | no |  |

> Bỏ `synced`, `partially_synced`, `failed` khỏi trạng thái duyệt. Tình trạng đồng bộ là việc riêng, tổng hợp từ `integration.external_task_links`.

### review_items

Nơi chứa nội dung AI đề xuất và nơi người dùng sửa **trước khi** duyệt.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `reviewBatchId` | string | yes | FK `review_batches._id` |
| `type` | string | yes | `action_item`, `decision`, `open_issue` |
| `originalPayload` | jsonb | yes | **mới** — bản AI sinh, giữ nguyên để đối chiếu |
| `payload` | jsonb | yes | nội dung hiện tại sau khi người dùng sửa |
| `status` | string | yes | `pending`, `approved`, `rejected` |
| `editedById` | string | no | **mới** |
| `editedAt` | datetime | no | **mới** |
| `rejectReason` | text | no |  |
| `actionItemId` | string | no | FK `action_items._id`, gán khi duyệt |
| `decisionId` | string | no | FK `decisions._id`, gán khi duyệt |

Index: `(reviewBatchId)`, `(workspaceId, status)`.

Thay đổi: bỏ trạng thái `edited`. Đã sửa vẫn có thể đang chờ duyệt — dùng `editedAt`/`editedById` thay vì trộn vào trạng thái.

**Luồng duyệt:**

1. AI sinh đề xuất → Core ghi `review_items` (`originalPayload = payload`).
2. Người dùng sửa `payload`, ghi `editedById`/`editedAt`.
3. Bấm duyệt → trong **một transaction**: tạo `action_items`/`decisions`, gán `review_items.actionItemId`, đặt `status = approved`.
4. Unique trên `action_items.reviewItemId` chặn việc bấm duyệt hai lần sinh hai task.

## Risk Detection

### risk_flags

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `userId` | string | no | người bị ảnh hưởng |
| `actionItemId` | string | no | FK `action_items._id` |
| `type` | string | yes | `overload`, `deadline_conflict`, `overdue`, `blocked_dependency` |
| `severity` | string | yes | `low`, `medium`, `high`, `critical` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `ruleKey` | string | yes | **mới** — quy tắc nào tạo cảnh báo (§6.11) |
| `evidence` | jsonb | yes | **mới** — dữ liệu dùng để kết luận |
| `dedupKey` | string | yes | **mới** — chống tạo lại cùng cảnh báo qua nhiều lần quét |
| `status` | string | yes | `open`, `acknowledged`, `resolved` |
| `detectedAt` | datetime | yes |  |
| `resolvedAt` | datetime | no |  |

Index: unique `(workspaceId, dedupKey)`; `(workspaceId, status)`, `(workspaceId, severity)`, `(workspaceId, userId)`.

> §6.11: mỗi cảnh báo phải nêu quy tắc và dữ liệu tạo ra nó → `ruleKey` + `evidence` là bắt buộc, không phải tùy chọn. `overload` chỉ được tính khi có dữ liệu effort/năng lực; số lượng task đơn thuần không đủ kết luận.

## Jobs & Messaging

### processing_jobs

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `type` | string | yes | `transcribe`, `summarize`, `extract_actions`, `detect_risks`, `index_rag` |
| `status` | string | yes | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `idempotencyKey` | string | yes | **mới** — ví dụ `{meetingId}:{type}:{inputVersion}` |
| `inputVersion` | string | no | **mới** — transcriptVersionId hoặc fileId dùng làm đầu vào |
| `payload` | jsonb | yes |  |
| `result` | jsonb | no |  |
| `error` | text | no |  |
| `retryCount` | integer | yes | default 0 |
| `nextRetryAt` | datetime | no | **mới** |
| `startedAt` | datetime | no | **mới** |
| `finishedAt` | datetime | no | **mới** |
| `heartbeatAt` | datetime | no | **mới** — phát hiện job treo |

Index: unique `idempotencyKey`; `(workspaceId, status)`, `(status, nextRetryAt)`.

### outbox_events

**Mới.** Ghi cùng transaction với thay đổi nghiệp vụ, publisher đọc và đẩy lên RabbitMQ. Bảo đảm không mất event khi service chết giữa chừng.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `aggregateType` | string | yes | `meeting`, `action_item`, ... |
| `aggregateId` | string | yes |  |
| `eventType` | string | yes | `transcription.requested`, ... |
| `eventVersion` | integer | yes |  |
| `payload` | jsonb | yes |  |
| `status` | string | yes | `pending`, `published`, `failed` |
| `publishedAt` | datetime | no |  |
| `retryCount` | integer | yes | default 0 |

Index: `(status, createdAt)`.

### processed_messages

**Mới.** Chống xử lý lặp khi RabbitMQ giao lại message.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `messageId` | string | yes | PK |
| `consumer` | string | yes | tên handler |
| `processedAt` | datetime | yes |  |

Index: unique `(messageId, consumer)`.

Bảng này lặp lại ở cả ba schema — mỗi service tự giữ bản dedup của mình.

---

# Schema `integration`

Không có FK nào trỏ sang schema `core`. Mọi `workspaceId`, `actionItemId`, `userId` ở đây là **tham chiếu logic**.

### integrations

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `provider` | string | yes | `jira`, `trello`, `slack`, `telegram`, `notion`, `confluence`, `google_calendar`, `google_docs` |
| `externalAccountId` | string | no | **mới** — định danh tài khoản/site bên ngoài |
| `displayName` | string | no | để người dùng phân biệt nhiều kết nối |
| `status` | string | yes | `connected`, `disconnected`, `error` |
| `connectedById` | string | no | *(ref ngoài)* |
| `accessTokenEncrypted` | text | no |  |
| `refreshTokenEncrypted` | text | no |  |
| `expiresAt` | datetime | no |  |
| `grantedScopes` | jsonb | no | **mới** — phạm vi thực tế được cấp |
| `config` | jsonb | no | mapping project/board/priority |
| `lastError` | text | no |  |

Index: unique `(workspaceId, provider, externalAccountId)`.

> Bản cũ dùng unique `(workspaceId, provider)` → chỉ cho một kết nối mỗi nhà cung cấp. Giữ nguyên nếu đó là ý định; nếu muốn hỗ trợ nhiều tài khoản Jira thì phải thêm `externalAccountId` như trên.

### calendar_events

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `integrationId` | string | yes | FK `integrations._id` — **thay cho `oauthAccountId`** |
| `calendarId` | string | yes | **mới** — một tài khoản có nhiều lịch |
| `providerEventId` | string | yes |  |
| `recurrenceInstanceId` | string | no | **mới** — phân biệt lần xuất hiện của lịch lặp |
| `meetingId` | string | no | *(ref ngoài)* |
| `title` | string | yes |  |
| `meetingUrl` | text | no |  |
| `startsAt` | datetime | yes |  |
| `endsAt` | datetime | no |  |
| `cancelledAt` | datetime | no | **mới** — webhook có thể báo hủy |
| `rawPayload` | jsonb | no |  |

Index: unique `(integrationId, calendarId, providerEventId, recurrenceInstanceId)`.

> Đổi từ `oauthAccountId` sang `integrationId` để Integration không phụ thuộc bảng Auth của Core.

### external_task_links

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `integrationId` | string | yes | FK `integrations._id` |
| `actionItemId` | string | yes | *(ref ngoài)* — **không FK** |
| `provider` | string | yes | `jira`, `trello` |
| `externalId` | string | yes |  |
| `externalKey` | string | no | `PROJ-123` |
| `externalUrl` | text | no |  |
| `lastSyncedAt` | datetime | no |  |
| `syncStatus` | string | yes | `pending`, `synced`, `failed` |
| `lastError` | text | no |  |

Index: unique `(integrationId, externalId)`, unique `(integrationId, actionItemId)`.

> Bản cũ dùng unique `(provider, externalId)` → hai workspace cùng dùng Jira sẽ đụng nhau. Phải gắn theo `integrationId`.

### sync_jobs

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `integrationId` | string | yes | FK `integrations._id` |
| `type` | string | yes | `push_task`, `pull_status`, `export_minutes` |
| `status` | string | yes | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `idempotencyKey` | string | yes | **mới** |
| `payload` | jsonb | yes |  |
| `result` | jsonb | no |  |
| `error` | text | no |  |
| `retryCount` | integer | yes | default 0 |
| `nextRetryAt` | datetime | no | **mới** |
| `startedAt` | datetime | no | **mới** |
| `finishedAt` | datetime | no | **mới** |

Index: unique `idempotencyKey`.

> **Không hoãn `sync_jobs` sang sau MVP.** Trường hợp hay gặp: gọi Jira tạo issue thành công nhưng mất phản hồi; gửi lại ngay sẽ tạo issue trùng. Với API không hỗ trợ idempotency, phải tra cứu đối soát trước khi retry tạo mới — dedup message nội bộ không giải quyết được trường hợp này.

Cộng thêm `outbox_events`, `processed_messages` như schema `core`.

---

# Schema `ai`

### ai_runs

**Mới.** Ghi chi tiết từng lần thực thi AI, tách khỏi `processing_jobs` (theo dõi tiến độ nghiệp vụ ở Core).

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `meetingId` | string | no | *(ref ngoài)* |
| `jobId` | string | no | *(ref ngoài)* `core.processing_jobs._id` |
| `taskType` | string | yes | `stt`, `summarize`, `extract_actions`, `embed` |
| `model` | string | yes | tên model thực tế |
| `modelVersion` | string | no |  |
| `inputRef` | jsonb | yes | object key hoặc transcriptVersionId |
| `status` | string | yes | `running`, `succeeded`, `failed` |
| `tokensIn` | integer | no | phục vụ đo chi phí |
| `tokensOut` | integer | no |  |
| `audioSeconds` | integer | no |  |
| `costEstimate` | decimal | no |  |
| `latencyMs` | integer | no |  |
| `error` | text | no |  |

Index: `(workspaceId, taskType, createdAt)`.

### document_chunks

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `projectId` | string | no | *(ref ngoài)* |
| `meetingId` | string | no | *(ref ngoài)* |
| `visibility` | string | yes | **mới** — sao chép từ `meetings.visibility` để lọc quyền trước khi truy xuất |
| `allowedUserIds` | jsonb | no | **mới** — với meeting `private`/`participants` |
| `sourceType` | string | yes | `transcript`, `minutes`, `note`, `action_item`, `decision` |
| `sourceId` | string | yes |  |
| `sourceVersion` | string | no | **mới** — transcriptVersionId / minutesVersionId |
| `chunkIndex` | integer | yes | **mới** |
| `content` | text | yes |  |
| `startMs` | integer | no |  |
| `endMs` | integer | no |  |
| `metadata` | jsonb | no | speaker, title, tags |
| `embedding` | vector | no | kích thước theo model thực tế, **không mặc định 1536** |
| `embeddingModel` | string | no | **mới** |
| `embeddingVersion` | string | no | **mới** |
| `indexStatus` | string | yes | **mới** — `pending`, `indexed`, `stale`, `deleted` |

Index: `(workspaceId, projectId)`, `(workspaceId, meetingId)`, `(sourceType, sourceId, sourceVersion)`, vector index cho `embedding`.

**Quy tắc bắt buộc (§6.12):**

- Lọc `workspaceId` **chưa đủ** — người dùng thuộc workspace vẫn có thể không được xem một project. Phải lọc theo `projectId` + `visibility` + `allowedUserIds` **trước** khi lấy nội dung đưa vào model.
- Kiểm tra lại quyền khi người dùng bấm mở nguồn trích dẫn.
- Nhận event `permission.changed` và `source.deleted` từ Core để đặt `indexStatus = stale/deleted` và lập chỉ mục lại.

### chat_threads

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `userId` | string | yes | *(ref ngoài)* |
| `scopeType` | string | yes | `workspace`, `project`, `meeting` |
| `scopeId` | string | no |  |
| `title` | string | no |  |
| `deletedAt` | datetime | no |  |

### chat_messages

Chỉ có `createdAt`.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | *(ref ngoài)* |
| `threadId` | string | yes | FK `chat_threads._id` |
| `role` | string | yes | `user`, `assistant`, `system` |
| `content` | text | yes |  |
| `citations` | jsonb | no | chunkId, meetingId, timestamp, sourceVersion |
| `insufficientEvidence` | boolean | no | true khi model từ chối kết luận vì thiếu nguồn |
| `aiRunId` | string | no | FK `ai_runs._id` |

---

## Quan hệ chính

```text
core
  users -> workspace_members -> workspaces
        -> project_members -> projects
        -> user_sessions, oauth_accounts

  meetings -> meeting_participants
           -> agenda_items
           -> recording_consents
           -> files -> recording_segments, upload_sessions
           -> bot_sessions
           -> transcript_versions -> transcript_segments -> speaker_aliases
           -> notes
           -> meeting_minutes -> minutes_versions
           -> decisions -> decision_citations
           -> review_batches -> review_items
           -> processing_jobs

  review_items --(duyệt)--> action_items
  action_items -> action_item_citations -> transcript_segments
               -> action_item_comments, action_item_history
               -> task_dependencies
               -> risk_flags

integration
  integrations -> calendar_events
               -> external_task_links   (actionItemId: ref ngoài)
               -> sync_jobs

ai
  ai_runs
  document_chunks                        (sourceId: ref ngoài)
  chat_threads -> chat_messages
```

## Thứ tự migration

**core** — bảng cha trước bảng con:

1. `users`, `oauth_accounts`, `user_sessions`
2. `workspaces`, `workspace_members`, `workspace_settings`
3. `projects`, `project_members`
4. `meetings`, `meeting_participants`, `agenda_items`, `recording_consents`
5. `files`, `upload_sessions`, `recording_segments`, `bot_sessions`
6. `transcript_versions`, `transcript_segments`, `speaker_aliases`
7. `notes`
8. `meeting_minutes`, `minutes_versions`, `decisions`, `decision_citations`
9. `review_batches`, `review_items`
10. `action_items`, `action_item_citations`, `action_item_comments`, `action_item_history`, `task_dependencies`
11. `risk_flags`
12. `processing_jobs`, `outbox_events`, `processed_messages`

**integration:** `integrations` → `calendar_events`, `external_task_links`, `sync_jobs` → `outbox_events`, `processed_messages`

**ai:** `ai_runs` → `document_chunks` → `chat_threads` → `chat_messages` → `processed_messages`

> Bước 9 đứng trước bước 10 vì `action_items.reviewItemId` trỏ tới `review_items`.

## Những bảng có thể hoãn sau MVP

- `chat_threads`, `chat_messages` nếu chưa làm giao diện RAG ngay.
- `task_dependencies` nếu MVP chưa cần cảnh báo `blocked_dependency`.
- `recording_consents` chỉ hoãn được nếu đơn vị chấp nhận rủi ro pháp lý — không khuyến nghị.
- `risk_flags` nếu ban đầu chỉ lọc quá hạn cơ bản.

**Không hoãn:** `sync_jobs`, `outbox_events`, `processed_messages`, `transcript_versions`, `minutes_versions`. Đây là các bảng bảo đảm tính đúng đắn, thêm sau sẽ phải sửa dữ liệu đã có.

## Khoảng cách với code hiện tại

18 module đã dựng trong `core-service` bám theo **bản thiết kế cũ**. Để khớp tài liệu này cần:

| Việc | Module ảnh hưởng |
| --- | --- |
| Thêm `sourceType`, `visibility`, `status`; bỏ `botStatus`, `audioFileId`; nới nullable | `meeting` |
| Bỏ `reviewStatus`, `approvedById`, `approvedAt`; thêm `proposerId`, `approverId`, `definitionOfDone`, `deadlineRawText` | `action-item` |
| Bỏ `synced`/`partially_synced`; thêm `sourceTranscriptVersionId` | `review-batch` |
| Bỏ trạng thái `edited`; thêm `originalPayload`, `editedAt`, `editedById` | `review-item` |
| Thêm `transcriptVersionId`, `identityStatus`, `isOverlapping` | `transcript-segment`, `speaker-alias` |
| Tách nội dung sang `minutes_versions` | `meeting-minutes` |
| Thêm `ruleKey`, `evidence`, `dedupKey` | `risk-flag` |
| Thêm `discipline` | `project-member` |
| Thêm `autoSyncEnabled` | `workspace-setting` |
| **Tạo mới** | `agenda-item`, `recording-consent`, `file`, `upload-session`, `recording-segment`, `bot-session`, `transcript-version`, `note`, `minutes-version`, `decision`, `decision-citation`, `task-dependency`, `processing-job`, `outbox-event`, `processed-message` |
