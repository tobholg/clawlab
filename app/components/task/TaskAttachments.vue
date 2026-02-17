<script setup lang="ts">
type TaskAttachment = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  url: string
  thumbUrl: string | null
  metadata: Record<string, unknown> | null
  canDelete: boolean
  createdAt: string
}

const props = defineProps<{
  itemId: string | null
}>()

const attachments = ref<TaskAttachment[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const dragDepth = ref(0)
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadRows = ref<Array<{ key: string; name: string; progress: number }>>([])
const lightbox = useLightbox()

const isUploading = computed(() => uploadRows.value.length > 0)

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const isImage = (mimeType: string) => mimeType.startsWith('image/')
const isPdf = (mimeType: string) => mimeType === 'application/pdf'
const isViewable = (mimeType: string) => isImage(mimeType) || isPdf(mimeType)

const viewableAttachments = computed(() => attachments.value.filter((attachment) => isViewable(attachment.mimeType)))
const viewableLightboxItems = computed(() =>
  viewableAttachments.value.map((attachment) => ({
    url: attachment.url,
    name: attachment.name,
    mimeType: attachment.mimeType,
    attachmentId: attachment.id,
  }))
)

const openAttachmentInLightbox = (attachment: TaskAttachment) => {
  if (!isViewable(attachment.mimeType)) return

  const startIndex = viewableAttachments.value.findIndex((entry) => entry.id === attachment.id)
  if (startIndex === -1) return

  lightbox.openGallery(viewableLightboxItems.value, startIndex)
}

const fileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return 'heroicons:document-text'
  if (mimeType.includes('zip') || mimeType.includes('tar')) return 'heroicons:archive-box'
  if (mimeType.includes('audio')) return 'heroicons:musical-note'
  if (mimeType.includes('video')) return 'heroicons:film'
  return 'heroicons:document'
}

const loadAttachments = async () => {
  if (!props.itemId) {
    attachments.value = []
    return
  }

  loading.value = true
  error.value = null
  try {
    attachments.value = await $fetch<TaskAttachment[]>(`/api/items/${props.itemId}/attachments`)
  } catch (e: any) {
    attachments.value = []
    error.value = e?.data?.message || e?.message || 'Failed to load attachments'
  } finally {
    loading.value = false
  }
}

const uploadSingleFile = async (file: File) => {
  if (!props.itemId) return

  const uploadKey = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  uploadRows.value.push({ key: uploadKey, name: file.name, progress: 0 })

  const updateProgress = (progress: number) => {
    const row = uploadRows.value.find((entry) => entry.key === uploadKey)
    if (row) row.progress = Math.max(0, Math.min(100, progress))
  }

  try {
    const uploaded = await new Promise<TaskAttachment>((resolve, reject) => {
      const formData = new FormData()
      formData.append('itemId', props.itemId as string)
      formData.append('file', file, file.name)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/attachments')
      xhr.responseType = 'json'

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          updateProgress(Math.round((event.loaded / event.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as TaskAttachment)
          return
        }

        const message =
          (xhr.response && typeof xhr.response === 'object' && 'statusMessage' in xhr.response && String(xhr.response.statusMessage)) ||
          (xhr.response && typeof xhr.response === 'object' && 'message' in xhr.response && String(xhr.response.message)) ||
          'Upload failed'
        reject(new Error(message))
      }

      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(formData)
    })

    attachments.value = [uploaded, ...attachments.value]
  } finally {
    uploadRows.value = uploadRows.value.filter((entry) => entry.key !== uploadKey)
  }
}

const uploadFiles = async (files: File[]) => {
  if (!files.length || !props.itemId) return
  error.value = null

  for (const file of files) {
    try {
      await uploadSingleFile(file)
    } catch (e: any) {
      error.value = e?.message || 'Upload failed'
      break
    }
  }
}

const onFileInput = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const selectedFiles = target.files ? Array.from(target.files) : []
  target.value = ''
  await uploadFiles(selectedFiles)
}

const openFilePicker = () => {
  fileInput.value?.click()
}

const onDragEnter = (event: DragEvent) => {
  event.preventDefault()
  dragDepth.value += 1
  isDragOver.value = true
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const onDragLeave = (event: DragEvent) => {
  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) isDragOver.value = false
}

const onDrop = async (event: DragEvent) => {
  event.preventDefault()
  dragDepth.value = 0
  isDragOver.value = false

  const droppedFiles = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  await uploadFiles(droppedFiles)
}

const removeAttachment = async (attachmentId: string) => {
  try {
    await $fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' })
    attachments.value = attachments.value.filter((attachment) => attachment.id !== attachmentId)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.data?.message || e?.message || 'Failed to delete attachment'
  }
}

watch(() => props.itemId, loadAttachments, { immediate: true })
</script>

<template>
  <section class="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.03] p-3 space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Attachments
        <span class="font-normal text-slate-400 dark:text-zinc-500">({{ attachments.length }})</span>
      </h3>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        @click="openFilePicker"
      >
        <Icon name="heroicons:paper-clip" class="w-3.5 h-3.5" />
        Upload
      </button>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        multiple
        @change="onFileInput"
      >
    </div>

    <div
      class="rounded-lg border border-dashed p-3 transition-colors"
      :class="isDragOver
        ? 'border-blue-400 bg-blue-50 dark:border-blue-400/70 dark:bg-blue-500/10'
        : 'border-slate-300 bg-white/80 dark:border-white/[0.12] dark:bg-white/[0.02]'"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <p class="text-xs text-slate-500 dark:text-zinc-500">
        Drop files here, or
        <button
          type="button"
          class="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 underline decoration-transparent hover:decoration-current transition-colors"
          @click="openFilePicker"
        >
          choose files
        </button>
      </p>
      <p class="text-[11px] mt-1 text-slate-400 dark:text-zinc-600">Images render inline. Other files show as cards.</p>
    </div>

    <div v-if="isUploading" class="space-y-2">
      <div
        v-for="row in uploadRows"
        :key="row.key"
        class="rounded-md border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card px-3 py-2"
      >
        <div class="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-300">
          <span class="truncate">{{ row.name }}</span>
          <span>{{ row.progress }}%</span>
        </div>
        <div class="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
          <div class="h-full bg-blue-500 transition-all duration-200" :style="{ width: `${row.progress}%` }" />
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
      {{ error }}
    </div>

    <div v-if="loading" class="text-xs text-slate-400 dark:text-zinc-500">
      Loading attachments...
    </div>

    <div v-else-if="attachments.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <article
        v-for="attachment in attachments"
        :key="attachment.id"
        class="group relative rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card overflow-hidden"
      >
        <button
          v-if="attachment.canDelete"
          type="button"
          class="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center leading-none rounded-md bg-white/90 dark:bg-black/50 text-slate-500 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-300 transition-colors opacity-0 group-hover:opacity-100"
          @click="removeAttachment(attachment.id)"
        >
          <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
        </button>

        <button
          v-if="isImage(attachment.mimeType)"
          type="button"
          class="block w-full text-left"
          @click="openAttachmentInLightbox(attachment)"
        >
          <img
            :src="attachment.thumbUrl || attachment.url"
            :alt="attachment.name"
            class="w-full max-h-40 object-cover bg-slate-100 dark:bg-white/[0.04]"
          >
          <div class="px-2.5 py-2 border-t border-slate-100 dark:border-white/[0.06]">
            <p class="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">{{ attachment.name }}</p>
            <p class="text-[11px] text-slate-400 dark:text-zinc-500">{{ formatBytes(attachment.sizeBytes) }}</p>
          </div>
        </button>

        <div
          v-else
          class="px-2.5 py-2.5"
          :class="isPdf(attachment.mimeType) ? 'cursor-pointer hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors' : ''"
          @click="openAttachmentInLightbox(attachment)"
        >
          <div class="flex items-start gap-2">
            <div class="w-8 h-8 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-500 dark:text-zinc-400">
              <Icon :name="fileIcon(attachment.mimeType)" class="w-4 h-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">{{ attachment.name }}</p>
              <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{{ formatBytes(attachment.sizeBytes) }}</p>
              <a
                :href="attachment.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 mt-1 text-[11px] text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
                @click.stop
              >
                <Icon name="heroicons:arrow-down-tray" class="w-3 h-3" />
                Download
              </a>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="text-xs text-slate-400 dark:text-zinc-500">
      No attachments yet.
    </div>
  </section>
</template>
