# MeetingMind - Database Design (MVP)

Thiết kế này dùng PostgreSQL làm nguồn dữ liệu chính, phù hợp với codebase hiện tại đang dùng Sequelize/NestJS và định hướng trong `ARCHITECTURE.md`.

## Nguyên tắc chung

- Primary key dùng `_id` dạng `string` để khớp `StrObjectId()` hiện có.
- Mỗi bảng nghiệp vụ nên có `workspaceId` để tách dữ liệu theo workspace.
- Dùng `deletedAt` cho soft delete ở dữ liệu người dùng tạo.
- Dùng `createdAt`, `updatedAt` thống nhất theo Sequelize.
- Các trạng thái nên khai báo enum trong code, DB có thể dùng `STRING` để dễ migration giai đoạn MVP.
- Transcript, citation, embedding là điểm khác biệt của MeetingMind, nên cần lưu đủ quan hệ tới meeting và timestamp.

## Nhóm Identity & Workspace

### users

Lưu tài khoản người dùng.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `email` | string | yes | unique |
| `username` | string | no | unique nếu dùng login nội bộ |
| `password` | string | no | null nếu chỉ SSO |
| `fullName` | string | no |  |
| `avatarUrl` | string | no |  |
| `systemRole` | string | yes | `SUPER_ADMIN`, `USER` |
| `lastLoginAt` | datetime | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
| `deletedAt` | datetime | no |  |

### oauth_accounts

Liên kết SSO Google/Microsoft.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `userId` | string | yes | FK `users._id` |
| `provider` | string | yes | `google`, `microsoft` |
| `providerAccountId` | string | yes | ID từ provider |
| `email` | string | yes |  |
| `accessTokenEncrypted` | text | no | mã hóa trước khi lưu |
| `refreshTokenEncrypted` | text | no | mã hóa trước khi lưu |
| `expiresAt` | datetime | no |  |
| `scope` | text | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `(provider, providerAccountId)`, index `userId`.

### workspaces

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `name` | string | yes |  |
| `slug` | string | yes | unique |
| `ownerId` | string | yes | FK `users._id` |
| `plan` | string | yes | `free`, `pro`, `business` |
| `timezone` | string | yes | ví dụ `Asia/Ho_Chi_Minh` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
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
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `(workspaceId, userId)`.

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
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
| `deletedAt` | datetime | no |  |

### project_members

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | yes | FK `projects._id` |
| `userId` | string | yes | FK `users._id` |
| `role` | string | yes | `PM`, `MEMBER`, `VIEWER` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `(projectId, userId)`.

## Nhóm Meeting

### meetings

Cuộc họp là trung tâm của hệ thống.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `meetingUrl` | text | yes | Google Meet/Teams/Zoom URL |
| `platform` | string | yes | `google_meet`, `teams`, `zoom`, `other` |
| `language` | string | yes | `vi`, `en`, ... |
| `scheduledStartAt` | datetime | yes |  |
| `scheduledEndAt` | datetime | no |  |
| `actualStartAt` | datetime | no |  |
| `actualEndAt` | datetime | no |  |
| `botStatus` | string | yes | `waiting`, `recording`, `processing`, `completed`, `failed` |
| `processingStatus` | string | yes | `pending`, `transcribing`, `summarizing`, `indexing`, `done`, `failed` |
| `audioFileId` | string | no | FK `files._id` nếu dùng module file hiện có |
| `createdById` | string | yes | FK `users._id` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
| `deletedAt` | datetime | no |  |

Index: `(workspaceId, scheduledStartAt)`, `(workspaceId, projectId)`, `(workspaceId, botStatus)`.

### meeting_participants

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `userId` | string | no | FK `users._id`, null nếu khách ngoài |
| `displayName` | string | yes | tên trong transcript hoặc calendar |
| `email` | string | no |  |
| `role` | string | no | `host`, `participant`, `bot` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

### calendar_events

Dùng cho auto-join từ Google/Microsoft Calendar.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `oauthAccountId` | string | yes | FK `oauth_accounts._id` |
| `provider` | string | yes | `google`, `microsoft` |
| `providerEventId` | string | yes |  |
| `meetingId` | string | no | FK `meetings._id` |
| `title` | string | yes |  |
| `meetingUrl` | text | no |  |
| `startsAt` | datetime | yes |  |
| `endsAt` | datetime | no |  |
| `rawPayload` | jsonb | no | dữ liệu gốc từ provider |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `(provider, providerEventId)`.

## Transcript & Smart Minutes

### transcript_segments

Mỗi dòng/đoạn transcript theo speaker và timestamp.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `speakerLabel` | string | yes | ví dụ `Speaker 1` |
| `speakerUserId` | string | no | FK `users._id` sau khi map |
| `startMs` | integer | yes | timestamp bắt đầu |
| `endMs` | integer | yes | timestamp kết thúc |
| `text` | text | yes | nội dung đã chỉnh sửa |
| `rawText` | text | no | nội dung gốc từ STT |
| `confidence` | decimal | no |  |
| `sequence` | integer | yes | thứ tự trong meeting |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: `(meetingId, sequence)`, full-text index cho `text`.

### speaker_aliases

Lưu việc sửa tên speaker.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `speakerLabel` | string | yes | `Speaker 1` |
| `displayName` | string | yes | tên người dùng sửa |
| `userId` | string | no | FK `users._id` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

### meeting_minutes

Biên bản thông minh, có thể sửa trước khi xuất.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `summary` | text | yes | phần tóm tắt |
| `decisions` | jsonb | yes | danh sách quyết định |
| `openIssues` | jsonb | yes | vấn đề tồn đọng |
| `editorContent` | jsonb | no | nội dung editor nếu dùng rich text |
| `status` | string | yes | `draft`, `approved`, `exported` |
| `approvedById` | string | no | FK `users._id` |
| `approvedAt` | datetime | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `meetingId`.

## Action Items & Task Board

### action_items

Task sinh từ AI hoặc tạo thủ công.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `assigneeId` | string | no | FK `users._id` |
| `deadline` | datetime | no |  |
| `priority` | string | yes | `low`, `medium`, `high`, `urgent` |
| `status` | string | yes | `todo`, `in_progress`, `blocked`, `done` |
| `source` | string | yes | `ai`, `manual`, `jira`, `trello` |
| `confidence` | decimal | no | độ tin cậy nếu do AI sinh |
| `reviewStatus` | string | yes | `pending`, `approved`, `rejected`, `synced` |
| `createdById` | string | no | FK `users._id` |
| `approvedById` | string | no | FK `users._id` |
| `approvedAt` | datetime | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
| `deletedAt` | datetime | no |  |

Index: `(workspaceId, status)`, `(workspaceId, assigneeId)`, `(workspaceId, deadline)`, `(workspaceId, projectId)`.

### action_item_citations

Link task về đoạn transcript gốc để chống bịa việc.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `transcriptSegmentId` | string | yes | FK `transcript_segments._id` |
| `startMs` | integer | yes | để nhảy audio/transcript |
| `endMs` | integer | yes |  |
| `quote` | text | yes | trích đoạn ngắn |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: `(actionItemId)`, `(meetingId, startMs)`.

### action_item_comments

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `authorId` | string | yes | FK `users._id` |
| `body` | text | yes |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
| `deletedAt` | datetime | no |  |

### action_item_history

Audit lịch sử đổi trạng thái, deadline, assignee, priority.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `actorId` | string | no | FK `users._id` |
| `field` | string | yes | ví dụ `status`, `deadline` |
| `oldValue` | jsonb | no |  |
| `newValue` | jsonb | no |  |
| `createdAt` | datetime | yes |  |

## Review Queue

### review_batches

Một lần AI đề xuất task/minutes sau meeting.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `status` | string | yes | `pending`, `approved`, `partially_synced`, `synced`, `failed` |
| `reviewerId` | string | no | FK `users._id` |
| `reviewedAt` | datetime | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

### review_items

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `reviewBatchId` | string | yes | FK `review_batches._id` |
| `actionItemId` | string | no | FK `action_items._id` |
| `type` | string | yes | `action_item`, `decision`, `open_issue` |
| `payload` | jsonb | yes | nội dung AI đề xuất |
| `status` | string | yes | `pending`, `approved`, `rejected`, `edited` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

## Integrations & Sync

### integrations

Kết nối Jira/Trello/Slack/Telegram/Notion/Confluence/Google Docs.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `provider` | string | yes | `jira`, `trello`, `slack`, `telegram`, `notion`, `confluence`, `google_docs` |
| `status` | string | yes | `connected`, `disconnected`, `error` |
| `connectedById` | string | no | FK `users._id` |
| `accessTokenEncrypted` | text | no |  |
| `refreshTokenEncrypted` | text | no |  |
| `expiresAt` | datetime | no |  |
| `config` | jsonb | no | mapping priority/project/board |
| `lastError` | text | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `(workspaceId, provider)`.

### external_task_links

Map action item nội bộ với Jira issue/Trello card.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `integrationId` | string | yes | FK `integrations._id` |
| `actionItemId` | string | yes | FK `action_items._id` |
| `provider` | string | yes | `jira`, `trello` |
| `externalId` | string | yes | issue/card ID |
| `externalKey` | string | no | ví dụ `PROJ-123` |
| `externalUrl` | text | no |  |
| `lastSyncedAt` | datetime | no |  |
| `syncStatus` | string | yes | `synced`, `failed`, `pending` |
| `lastError` | text | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `(provider, externalId)`, unique `(integrationId, actionItemId)`.

### sync_jobs

Lưu lịch sử push/retry.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `integrationId` | string | yes | FK `integrations._id` |
| `type` | string | yes | `push_task`, `pull_status`, `export_minutes` |
| `status` | string | yes | `queued`, `running`, `succeeded`, `failed` |
| `payload` | jsonb | yes |  |
| `result` | jsonb | no |  |
| `error` | text | no |  |
| `retryCount` | integer | yes | default 0 |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

## RAG & Chat

### document_chunks

Nguồn tri thức để hỏi đáp: transcript, minutes, decisions, tasks.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `sourceType` | string | yes | `transcript`, `minutes`, `action_item`, `decision` |
| `sourceId` | string | yes | ID của bản ghi nguồn |
| `content` | text | yes | nội dung chunk |
| `startMs` | integer | no | nếu là transcript |
| `endMs` | integer | no | nếu là transcript |
| `metadata` | jsonb | no | speaker, title, tags |
| `embedding` | vector | no | pgvector, ví dụ `vector(1536)` |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: `(workspaceId, projectId)`, `(workspaceId, meetingId)`, vector index cho `embedding`.

### chat_threads

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `userId` | string | yes | FK `users._id` |
| `scopeType` | string | yes | `workspace`, `project`, `meeting` |
| `scopeId` | string | no | projectId/meetingId |
| `title` | string | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |
| `deletedAt` | datetime | no |  |

### chat_messages

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `threadId` | string | yes | FK `chat_threads._id` |
| `role` | string | yes | `user`, `assistant`, `system` |
| `content` | text | yes |  |
| `citations` | jsonb | no | meeting/timestamp/chunk references |
| `createdAt` | datetime | yes |  |

## Risk Detection

### risk_flags

Các cảnh báo overload, deadline chồng chéo, task quá hạn.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `projectId` | string | no | FK `projects._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `userId` | string | no | người bị ảnh hưởng |
| `actionItemId` | string | no | task liên quan |
| `type` | string | yes | `overload`, `deadline_conflict`, `overdue`, `blocked_dependency` |
| `severity` | string | yes | `low`, `medium`, `high`, `critical` |
| `title` | string | yes |  |
| `description` | text | no |  |
| `status` | string | yes | `open`, `acknowledged`, `resolved` |
| `detectedAt` | datetime | yes |  |
| `resolvedAt` | datetime | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: `(workspaceId, status)`, `(workspaceId, severity)`, `(workspaceId, userId)`.

## Bot & Processing Jobs

### bot_sessions

Một lần bot vào phòng họp.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | yes | FK `meetings._id` |
| `status` | string | yes | `scheduled`, `joining`, `recording`, `left`, `failed` |
| `joinUrl` | text | yes |  |
| `startedAt` | datetime | no |  |
| `endedAt` | datetime | no |  |
| `audioFileId` | string | no | FK `files._id` |
| `error` | text | no |  |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

### processing_jobs

Job nền qua RabbitMQ: transcribe, summarize, extract action, index RAG.

| Column | Type | Required | Note |
| --- | --- | --- | --- |
| `_id` | string | yes | PK |
| `workspaceId` | string | yes | FK `workspaces._id` |
| `meetingId` | string | no | FK `meetings._id` |
| `type` | string | yes | `transcribe`, `summarize`, `extract_actions`, `detect_risks`, `index_rag` |
| `status` | string | yes | `queued`, `running`, `succeeded`, `failed` |
| `payload` | jsonb | yes |  |
| `result` | jsonb | no |  |
| `error` | text | no |  |
| `retryCount` | integer | yes | default 0 |
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

## Settings & Data Governance

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
| `createdAt` | datetime | yes |  |
| `updatedAt` | datetime | yes |  |

Index: unique `workspaceId`.

## Quan hệ chính

```text
users
  -> workspace_members -> workspaces
  -> project_members -> projects

workspaces
  -> projects
  -> meetings
  -> action_items
  -> integrations
  -> chat_threads

projects
  -> meetings
  -> action_items
  -> risk_flags

meetings
  -> meeting_participants
  -> transcript_segments
  -> meeting_minutes
  -> action_items
  -> bot_sessions
  -> processing_jobs
  -> document_chunks

action_items
  -> action_item_citations -> transcript_segments
  -> action_item_comments
  -> action_item_history
  -> external_task_links
```

## MVP migration order

1. `users`, `oauth_accounts`
2. `workspaces`, `workspace_members`, `workspace_settings`
3. `projects`, `project_members`
4. `meetings`, `meeting_participants`, `calendar_events`
5. `transcript_segments`, `speaker_aliases`, `meeting_minutes`
6. `action_items`, `action_item_citations`, `action_item_comments`, `action_item_history`
7. `review_batches`, `review_items`
8. `integrations`, `external_task_links`, `sync_jobs`
9. `document_chunks`, `chat_threads`, `chat_messages`
10. `risk_flags`, `bot_sessions`, `processing_jobs`

## Gợi ý chia service ownership

- `core-service`: `users`, `workspaces`, `workspace_members`, `projects`, `project_members`, `meetings`, `meeting_participants`, `meeting_minutes`, `action_items`, `review_*`, `risk_flags`, `workspace_settings`.
- `integration-service`: `integrations`, `external_task_links`, `sync_jobs`, `calendar_events`.
- `ai-service`: đọc/ghi `transcript_segments`, `document_chunks`, `processing_jobs`; có thể qua API/core event thay vì truy cập DB trực tiếp nếu muốn ranh giới service sạch hơn.
- `bot-worker`: ghi `bot_sessions`, cập nhật trạng thái meeting, upload audio vào `files`/MinIO.

## Những bảng có thể hoãn sau MVP

- `chat_threads`, `chat_messages` nếu chưa làm RAG UI ngay.
- `risk_flags` nếu ban đầu chỉ lọc overdue/basic workload.
- `sync_jobs` nếu push Jira/Trello ban đầu chạy đồng bộ đơn giản.
- `speaker_aliases` nếu chỉ sửa trực tiếp trên `transcript_segments`.

