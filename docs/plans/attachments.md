# Attachments System

## Overview

Universal attachment system for ClawLab. Files can be attached to tasks (items) and channel messages. Attachments dropped in channels can be transferred to tasks. Local disk storage for self-hosted, no cloud dependencies.

## Data Model

```prisma
model Attachment {
  id          String   @id @default(cuid())
  type        AttachmentType @default(FILE)
  name        String         // Original filename or display name
  mimeType    String?        // e.g. "image/png", "application/pdf"
  sizeBytes   Int
  storagePath String         // Relative path under data/uploads/
  metadata    Json?          // Dimensions for images, duration for video, etc.

  // Polymorphic ownership: one of these is set
  itemId    String?          // Attached to a task/project
  messageId String?          // Attached to a channel message

  uploadedById String
  createdAt    DateTime @default(now())

  item      Item?    @relation(fields: [itemId], references: [id], onDelete: Cascade)
  message   Message? @relation(fields: [messageId], references: [id], onDelete: Cascade)
  uploadedBy User    @relation(fields: [uploadedById], references: [id])

  @@index([itemId])
  @@index([messageId])
  @@index([uploadedById])
  @@map("attachments")
}

enum AttachmentType {
  FILE
  LINK    // Future: URL with preview
  EMBED   // Future: inline content
}
```

Add relations to existing models:

```prisma
// On Item model:
attachments Attachment[]

// On Message model:
attachments Attachment[] // replaces current Json attachments field

// On User model:
uploads Attachment[]
```

**Note:** Message model currently has `attachments Json?` used for AI task proposals. Migration needs to handle this — rename old field to `attachmentData` or migrate proposals to a separate mechanism, then add the relation.

## Storage

### Directory Structure

```
data/
  uploads/
    {year-month}/
      {cuid}.{ext}        # Original file
      {cuid}_thumb.{ext}  # Thumbnail (images only, generated on upload)
```

- Year-month bucketing prevents single-directory bloat
- CUIDs as filenames avoid collisions and path traversal
- Original filename stored in DB, not on disk
- Thumbnails generated for images at upload time (max 400px wide)

### Configuration

```env
UPLOAD_DIR=./data/uploads      # Default, configurable
UPLOAD_MAX_SIZE=268435456      # 256MB in bytes
```

### Serving Files

`GET /api/files/:id` — authenticated file serving route.

- Looks up attachment by ID
- Checks auth: user must be workspace member (for task attachments) or channel member (for message attachments)
- Streams file from disk with correct `Content-Type` and `Content-Disposition`
- Cache headers for immutable content (`Cache-Control: public, max-age=31536000, immutable`)
- Thumbnail variant: `GET /api/files/:id/thumb`

## API Endpoints

### Upload

**`POST /api/attachments`** (multipart/form-data)

```
file: <binary>
itemId?: string          # Attach to task
messageId?: string       # Attach to message (set after message creation)
```

Returns:
```json
{
  "id": "clxyz...",
  "name": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 245760,
  "url": "/api/files/clxyz...",
  "thumbUrl": "/api/files/clxyz.../thumb",
  "metadata": { "width": 1920, "height": 1080 },
  "createdAt": "2026-02-17T..."
}
```

Validation:
- Max file size: 256MB (configurable)
- Reject if neither `itemId` nor `messageId` will be set (orphan prevention)
- Verify user has access to the target item/channel

### Upload for Channel Messages

Messages with attachments need a two-step flow since the message doesn't exist yet:

**Option A (simpler):** Upload returns attachment ID, message creation accepts `attachmentIds: string[]` and links them.

**Option B:** Upload with no parent, message creation links them. Orphan cleanup via cron.

**Recommended: Option A.** Upload first, get IDs, send message with IDs. No orphan problem.

Flow:
1. User drops file in message input → `POST /api/attachments` (no parent yet) → gets attachment ID
2. User sends message → `POST /api/channels/:id/messages` with `{ content, attachmentIds: ["clxyz..."] }`
3. Server links attachments to the message

Orphan protection: attachments without a parent after 1 hour get cleaned up by a background job (or on next server start).

### Transfer: Channel → Task

**`POST /api/attachments/:id/transfer`**

```json
{
  "itemId": "target-task-id"
}
```

- Creates a copy of the attachment record pointing to the task (same storage file, no duplicate on disk)
- Or moves it: sets `itemId`, keeps `messageId` too (attachment belongs to both)
- Auth: user must have access to both the source message's channel and the target task

**Recommended: Dual ownership.** Set `itemId` on the existing attachment without removing `messageId`. File stays visible in both places. Simple, no duplication.

### List Attachments

**`GET /api/items/:id/attachments`** — all attachments on a task

**`GET /api/agents/tasks/:id/attachments`** — agent API variant

### Delete

**`DELETE /api/attachments/:id`** — removes record and file from disk. Auth: uploader or workspace admin.

## Agent API

**`POST /api/agents/tasks/:id/attachments`** — multipart upload, same as human API but uses agent auth.

**CLI:**
```bash
clawlab attach <task-id> <file-path>       # Upload file to task
clawlab attachments <task-id>              # List attachments
```

## Frontend

### Task Modal / Task Page

**Attachments section** below description, above comments:

```
┌─────────────────────────────────────┐
│ 📎 Attachments (3)                  │
│                                     │
│ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │ img  │ │ img  │ │ PDF  │        │
│ │      │ │      │ │ icon │        │
│ └──────┘ └──────┘ └──────┘        │
│  hero.png  mock.jpg  spec.pdf      │
│                                     │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │  Drop files here or click   │   │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
└─────────────────────────────────────┘
```

- Images: inline thumbnail preview (click to expand in lightbox — v2)
- Non-images: file card with icon, name, size, download button
- Drag-and-drop zone on the entire modal body (highlight border on dragover)
- Upload button as fallback
- Progress indicator during upload
- Delete button (x) on hover, uploader or admin only

### Channel Messages

**Message input:**
- Drag-and-drop on input area
- Paste from clipboard (images)
- Attachment button (📎) next to send
- Preview thumbnails below input before sending
- Upload starts immediately on drop/paste, message sends with attachment IDs

**Message rendering:**
- Images: inline, max-width constrained, click to expand
- Non-images: compact file card (icon + name + size + download link)
- Multiple attachments: grid layout for images, stacked for files

**Transfer to task:**
- Hover/right-click on attachment in a message → "Add to task..." action
- Opens task picker (search by title)
- Links attachment to selected task

### Clipboard Paste

Both task modal and channel input support `ctrl+V` / `cmd+V`:
- If clipboard contains an image → create a file from it (`paste-{timestamp}.png`)
- Upload immediately, show preview

## Migration Notes

1. The current `Message.attachments` field is `Json?` used for AI task proposals (`{ type: 'task_proposal', proposal }`). This needs to coexist:
   - Rename field to `inlineData` (or `embeds`)
   - Add `attachments Attachment[]` relation
   - Update `ai.post.ts` and `MessageTaskProposal.vue` to use new field name

2. Create migration for `Attachment` model and `AttachmentType` enum.

## Implementation Chunks

### Chunk 1: Core (storage + upload + serve + task attachments)
- Attachment model + migration
- `server/utils/storage.ts` — save file, generate thumbnail, delete, serve
- `POST /api/attachments` (upload)
- `GET /api/files/:id` (serve)
- `GET /api/items/:id/attachments` (list)
- `DELETE /api/attachments/:id`
- Task modal: attachments section, drag-and-drop, image preview, file cards
- Agent API: `POST /api/agents/tasks/:id/attachments`, CLI `clawlab attach`

### Chunk 2: Channel attachments
- Update message creation to accept `attachmentIds`
- Message input: drag-and-drop, paste, 📎 button, preview before send
- Message rendering: inline images, file cards
- Orphan cleanup

### Chunk 3: Transfer + polish
- `POST /api/attachments/:id/transfer` endpoint
- "Add to task..." UI on channel message attachments
- Task picker modal
- Lightbox for image expansion (v2 polish)

## Security

- Files served through authenticated API route, never directly from disk
- Path traversal prevention: CUIDs only, no user-controlled paths
- MIME type validated against file content (not just extension)
- Workspace/channel membership required for access
- Storage directory outside web root
