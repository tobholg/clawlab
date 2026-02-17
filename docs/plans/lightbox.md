# Lightbox — Image & PDF Viewer

## Overview
Global lightbox component for viewing images and PDFs from channel messages and task attachments. Opens on click, supports gallery navigation when multiple attachments exist.

## Component: `app/components/ui/AppLightbox.vue`

### Props / State (via composable)
- `items: LightboxItem[]` — all viewable attachments in context
- `currentIndex: number` — which item is shown
- `isOpen: boolean`

```ts
interface LightboxItem {
  url: string          // /api/files/:id
  name: string         // original filename
  mimeType: string     // image/*, application/pdf
  attachmentId?: string
}
```

### Layout
- **Overlay**: fixed inset-0, bg-black/80, z-50, backdrop-blur-sm
- **Top bar**: filename (left), download button + close button (right), bg-black/40, text-white
- **Content area**: centered, max-w/max-h with padding
  - Images: `<img>` with `object-contain`, max-h-[85vh]
  - PDFs: `<iframe>` with fallback "Can't preview — Download" link
  - Unsupported types: file icon + "Download" button
- **Nav arrows**: left/right chevrons, only when `items.length > 1`, positioned absolute at vertical center
- **Counter**: "2 / 5" bottom center, only when `items.length > 1`

### Interactions
- **Esc** → close
- **Click overlay** (outside content) → close
- **Arrow left/right** → prev/next (wraps)
- **Download button** → `<a href="..." download>` triggering browser download
- No zoom/pan for v1

## Composable: `app/composables/useLightbox.ts`

```ts
const lightbox = useLightbox()

// Open single item
lightbox.open({ url, name, mimeType })

// Open gallery at index
lightbox.openGallery(items, startIndex)

// Close
lightbox.close()
```

State stored in a module-level `reactive()` (singleton pattern, same as `useTaskDetail`).

## Integration

### 1. Channel messages — `ChannelMessage.vue` (or wherever message attachments render)
- Inline image thumbnails: wrap in `<button @click="lightbox.open(...)">` 
- Collect all image/PDF attachments in the message for gallery context
- Non-viewable files: no click behavior (just download link)

### 2. Task attachments — `TaskAttachments.vue`
- Image thumbnails and PDF rows: click → `lightbox.openGallery(viewableAttachments, index)`
- `viewableAttachments` = filter to image/* and application/pdf only

### Helper
```ts
function isViewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}
```

## Files to create
- `app/components/ui/AppLightbox.vue` — the component
- `app/composables/useLightbox.ts` — singleton composable

## Files to modify
- `app/app.vue` (or default layout) — mount `<AppLightbox />` once
- `app/components/task/TaskAttachments.vue` — add click handlers on viewable items
- Channel message attachment rendering (wherever inline images are rendered for Chunk 2) — add click handlers

## Out of scope
- Video/audio playback (just download)
- Zoom/pan gestures
- Drag to resize
