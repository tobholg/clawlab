<script setup lang="ts">
interface MentionMember {
  id: string
  name: string
  isAgent: boolean
  avatar?: string | null
}

interface ActiveMention {
  userId: string
  displayName: string
}

interface PendingAttachment {
  localId: string
  id: string | null
  name: string
  mimeType: string
  sizeBytes: number
  previewUrl: string | null
  progress: number
  uploading: boolean
  error: string | null
}

interface UploadAttachmentResponse {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
}

const props = defineProps<{
  channelId: string
  parentId?: string
  placeholder?: string
  disabled?: boolean
  hideHelper?: boolean
  members?: MentionMember[]
}>()

const emit = defineEmits<{
  messageSent: [payload: { content: string; attachmentIds: string[] }]
  typing: []
  stopTyping: []
}>()

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const sending = ref(false)
const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const lastTypingEmit = ref(0)
const mentionQuery = ref('')
const mentionStart = ref<number | null>(null)
const mentionCursor = ref<number | null>(null)
const selectedMentionIndex = ref(0)
const dragDepth = ref(0)
const isDragOver = ref(false)
const uploadError = ref<string | null>(null)

const pendingAttachments = ref<PendingAttachment[]>([])

// Track active mentions: map from "@DisplayName" as it appears in textarea -> userId
const activeMentions = ref<ActiveMention[]>([])

const TYPING_THROTTLE = 1000

const filteredMentions = computed(() => {
  if (mentionStart.value === null) return []

  const query = mentionQuery.value.trim().toLowerCase()
  const allMembers = props.members || []
  const matches = query.length === 0
    ? allMembers
    : allMembers.filter((member) => member.name.toLowerCase().includes(query))

  return matches
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(query)
      const bStarts = b.name.toLowerCase().startsWith(query)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.name.localeCompare(b.name)
    })
    .slice(0, 6)
})

const showMentions = computed(() => filteredMentions.value.length > 0 && mentionStart.value !== null)

const readyAttachmentIds = computed(() => {
  return pendingAttachments.value
    .filter((attachment) => !!attachment.id && !attachment.uploading && !attachment.error)
    .map((attachment) => attachment.id as string)
})

const uploadingCount = computed(() => pendingAttachments.value.filter((attachment) => attachment.uploading).length)
const hasUploadInFlight = computed(() => uploadingCount.value > 0)

const canSend = computed(() => {
  if (props.disabled || sending.value || hasUploadInFlight.value) return false
  return content.value.trim().length > 0 || readyAttachmentIds.value.length > 0
})

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const isImageMime = (mimeType: string) => mimeType.startsWith('image/')

const fileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return 'heroicons:document-text'
  if (mimeType.includes('zip') || mimeType.includes('tar')) return 'heroicons:archive-box'
  if (mimeType.includes('audio')) return 'heroicons:musical-note'
  if (mimeType.includes('video')) return 'heroicons:film'
  return 'heroicons:document'
}

const resetMentionState = () => {
  mentionQuery.value = ''
  mentionStart.value = null
  mentionCursor.value = null
  selectedMentionIndex.value = 0
}

const adjustHeight = () => {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
}

const updateMentionState = () => {
  if (!textareaRef.value) {
    resetMentionState()
    return
  }

  const cursor = textareaRef.value.selectionStart ?? content.value.length
  mentionCursor.value = cursor

  const beforeCursor = content.value.slice(0, cursor)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex === -1) {
    resetMentionState()
    return
  }

  const prefixChar = atIndex > 0 ? beforeCursor[atIndex - 1] : ''
  if (prefixChar && !/\s/.test(prefixChar)) {
    resetMentionState()
    return
  }

  // Check if cursor is inside an already-applied mention to avoid reopening autocomplete.
  const afterAt = beforeCursor.slice(atIndex)
  for (const mention of activeMentions.value) {
    const mentionText = `@${mention.displayName}`
    if (afterAt === mentionText || afterAt.startsWith(mentionText)) {
      resetMentionState()
      return
    }
  }

  const candidate = beforeCursor.slice(atIndex)
  if (!/^@[\w\s]*$/.test(candidate) || candidate.length > 40) {
    resetMentionState()
    return
  }

  mentionStart.value = atIndex
  mentionQuery.value = candidate.slice(1)
  if (selectedMentionIndex.value >= filteredMentions.value.length) {
    selectedMentionIndex.value = 0
  }
}

// Prune activeMentions when content changes (user might delete a mention)
const pruneStale = () => {
  activeMentions.value = activeMentions.value.filter((m) =>
    content.value.includes(`@${m.displayName}`)
  )
}

watch(content, (newVal) => {
  nextTick(adjustHeight)
  pruneStale()
  updateMentionState()

  if (newVal && newVal.length > 0) {
    const now = Date.now()
    if (now - lastTypingEmit.value > TYPING_THROTTLE) {
      lastTypingEmit.value = now
      emit('typing')
    }

    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }

    typingTimeout.value = setTimeout(() => {
      lastTypingEmit.value = 0
      emit('stopTyping')
    }, 2000)
  } else {
    lastTypingEmit.value = 0
    emit('stopTyping')
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }
    resetMentionState()
    activeMentions.value = []
  }
})

const applyMention = (member: MentionMember) => {
  if (mentionStart.value === null || mentionCursor.value === null) return

  // Insert display name, not raw token
  const displayText = `@${member.name} `
  const before = content.value.slice(0, mentionStart.value)
  const after = content.value.slice(mentionCursor.value)
  const nextValue = `${before}${displayText}${after}`
  const nextCursor = before.length + displayText.length

  if (!activeMentions.value.find((m) => m.userId === member.id)) {
    activeMentions.value.push({
      userId: member.id,
      displayName: member.name,
    })
  }

  content.value = nextValue

  nextTick(() => {
    if (!textareaRef.value) return
    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(nextCursor, nextCursor)
    updateMentionState()
  })

  resetMentionState()
}

// Serialize content: replace @DisplayName with <@userId> before sending.
const serializeContent = (raw: string): string => {
  let result = raw
  const sorted = [...activeMentions.value].sort(
    (a, b) => b.displayName.length - a.displayName.length
  )
  for (const mention of sorted) {
    result = result.replaceAll(`@${mention.displayName}`, `<@${mention.userId}>`)
  }
  return result
}

const moveMentionSelection = (direction: 1 | -1) => {
  if (!showMentions.value) return
  const count = filteredMentions.value.length
  if (!count) return
  selectedMentionIndex.value = (selectedMentionIndex.value + direction + count) % count
}

const patchAttachment = (localId: string, patch: Partial<PendingAttachment>) => {
  const target = pendingAttachments.value.find((attachment) => attachment.localId === localId)
  if (!target) return
  Object.assign(target, patch)
}

const uploadSingleFile = async (file: File) => {
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const previewUrl = isImageMime(file.type) ? URL.createObjectURL(file) : null

  pendingAttachments.value.push({
    localId,
    id: null,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    previewUrl,
    progress: 0,
    uploading: true,
    error: null,
  })

  try {
    const uploaded = await new Promise<UploadAttachmentResponse>((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file, file.name)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/attachments')
      xhr.responseType = 'json'

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          patchAttachment(localId, {
            progress: Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))),
          })
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as UploadAttachmentResponse)
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

    patchAttachment(localId, {
      id: uploaded.id,
      name: uploaded.name,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      progress: 100,
      uploading: false,
      error: null,
    })
  } catch (error: any) {
    patchAttachment(localId, {
      uploading: false,
      progress: 0,
      error: error?.message || 'Upload failed',
    })
    uploadError.value = error?.message || 'Upload failed'
  }
}

const uploadFiles = (files: File[]) => {
  if (!files.length || props.disabled) return
  uploadError.value = null
  for (const file of files) {
    void uploadSingleFile(file)
  }
}

const openFilePicker = () => {
  if (props.disabled) return
  fileInputRef.value?.click()
}

const onFileInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const selectedFiles = target.files ? Array.from(target.files) : []
  target.value = ''
  uploadFiles(selectedFiles)
}

const onDragEnter = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled) return
  dragDepth.value += 1
  isDragOver.value = true
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled) return
  isDragOver.value = true
}

const onDragLeave = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) {
    isDragOver.value = false
  }
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  dragDepth.value = 0
  isDragOver.value = false
  if (props.disabled) return

  const droppedFiles = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  uploadFiles(droppedFiles)
}

const onPaste = (event: ClipboardEvent) => {
  if (props.disabled) return

  const items = event.clipboardData?.items
  if (!items || items.length === 0) return

  const imageFiles: File[] = []
  let imageIndex = 0

  for (const item of Array.from(items)) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (!file) continue
    const timestamp = Date.now() + imageIndex
    imageFiles.push(new File([file], `paste-${timestamp}.png`, { type: file.type || 'image/png' }))
    imageIndex += 1
  }

  if (imageFiles.length > 0) {
    event.preventDefault()
    uploadFiles(imageFiles)
  }
}

const removePendingAttachment = async (localId: string) => {
  const attachment = pendingAttachments.value.find((row) => row.localId === localId)
  if (!attachment) return

  if (attachment.uploading) return

  if (attachment.id) {
    try {
      await $fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' })
    } catch (error: any) {
      uploadError.value = error?.data?.statusMessage || error?.data?.message || error?.message || 'Failed to remove attachment'
      return
    }
  }

  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }

  pendingAttachments.value = pendingAttachments.value.filter((row) => row.localId !== localId)
}

const clearPendingAttachments = () => {
  for (const attachment of pendingAttachments.value) {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
  }
  pendingAttachments.value = []
}

const handleKeydown = (e: KeyboardEvent) => {
  if (showMentions.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveMentionSelection(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveMentionSelection(-1)
      return
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      const member = filteredMentions.value[selectedMentionIndex.value]
      if (member) {
        e.preventDefault()
        applyMention(member)
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      resetMentionState()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void sendMessage()
  }
}

const sendMessage = async () => {
  const trimmed = content.value.trim()
  const attachmentIds = [...readyAttachmentIds.value]

  if ((!trimmed && attachmentIds.length === 0) || sending.value || props.disabled || hasUploadInFlight.value) return

  sending.value = true
  try {
    lastTypingEmit.value = 0
    emit('stopTyping')
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }

    const serialized = serializeContent(trimmed)
    emit('messageSent', {
      content: serialized,
      attachmentIds,
    })

    content.value = ''
    activeMentions.value = []
    uploadError.value = null
    clearPendingAttachments()
    nextTick(adjustHeight)
  } finally {
    sending.value = false
  }
}

// Computed: render content with highlighted mentions for the overlay
const highlightedSegments = computed(() => {
  if (activeMentions.value.length === 0) return null

  const text = content.value
  const segments: { text: string; isMention: boolean }[] = []

  const sorted = [...activeMentions.value].sort(
    (a, b) => b.displayName.length - a.displayName.length
  )
  const escaped = sorted.map((m) => `@${m.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isMention: false })
    }
    segments.push({ text: match[0], isMention: true })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isMention: false })
  }

  return segments.length > 0 ? segments : null
})

const focus = () => {
  textareaRef.value?.focus()
}

onBeforeUnmount(() => {
  clearPendingAttachments()
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value)
    typingTimeout.value = null
  }
})

defineExpose({ focus })
</script>

<template>
  <div class="border-t border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-surface px-4 py-3">
    <div class="max-w-3xl mx-auto">
      <div class="flex items-end gap-2">
        <div
          class="flex-1 relative rounded-xl border transition-colors"
          :class="isDragOver
            ? 'border-blue-400 bg-blue-50/70 dark:border-blue-400/70 dark:bg-blue-500/10'
            : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card'"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <Transition
            enter-active-class="transition-all duration-150 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div
              v-if="showMentions"
              class="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-dm-card"
            >
              <button
                v-for="(member, index) in filteredMentions"
                :key="member.id"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                :class="index === selectedMentionIndex ? 'bg-slate-100 dark:bg-white/[0.08]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.05]'"
                @mousedown.prevent
                @click="applyMention(member)"
              >
                <div class="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-medium text-slate-700 dark:bg-white/[0.08] dark:text-zinc-200">
                  <img v-if="member.avatar" :src="member.avatar" :alt="member.name" class="h-full w-full object-cover" >
                  <span v-else>{{ member.name.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{{ member.name }}</p>
                </div>
                <span
                  v-if="member.isAgent"
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                >
                  Agent
                </span>
              </button>
            </div>
          </Transition>

          <div
            v-if="highlightedSegments"
            class="absolute inset-0 pointer-events-none px-3 py-2 text-sm whitespace-pre-wrap break-words overflow-hidden text-transparent"
            aria-hidden="true"
          >
            <template v-for="(seg, i) in highlightedSegments" :key="i">
              <span
                v-if="seg.isMention"
                class="rounded bg-blue-100 dark:bg-blue-500/20 text-transparent"
              >{{ seg.text }}</span>
              <span v-else class="text-transparent">{{ seg.text }}</span>
            </template>
          </div>

          <textarea
            ref="textareaRef"
            v-model="content"
            :placeholder="placeholder || 'Type a message...'"
            :disabled="disabled || sending"
            rows="1"
            class="w-full px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 bg-transparent placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
            :class="{ 'caret-slate-900 dark:caret-zinc-100': highlightedSegments }"
            @keydown="handleKeydown"
            @input="updateMentionState"
            @click="updateMentionState"
            @keyup="updateMentionState"
            @paste="onPaste"
          />
        </div>

        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card text-slate-500 dark:text-zinc-300 hover:text-slate-700 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Attach files"
          :disabled="disabled || sending"
          @click="openFilePicker"
        >
          <Icon name="heroicons:paper-clip" class="w-4 h-4" />
        </button>

        <button
          :disabled="!canSend"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-slate-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Send message"
          @click="sendMessage"
        >
          <Icon
            :name="sending ? 'heroicons:arrow-path' : 'heroicons:paper-airplane'"
            :class="['w-4 h-4', sending ? 'animate-spin' : '']"
          />
        </button>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        multiple
        @change="onFileInput"
      >

      <div v-if="pendingAttachments.length > 0" class="mt-2 space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <article
            v-for="attachment in pendingAttachments"
            :key="attachment.localId"
            class="group relative rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-dm-card overflow-hidden"
          >
            <button
              type="button"
              class="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center leading-none rounded-md bg-white/90 dark:bg-black/50 text-slate-500 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
              :class="attachment.uploading ? 'opacity-40 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'"
              :disabled="attachment.uploading"
              @click="removePendingAttachment(attachment.localId)"
            >
              <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
            </button>

            <div v-if="attachment.previewUrl" class="block">
              <img
                :src="attachment.previewUrl"
                :alt="attachment.name"
                class="w-full h-24 object-cover bg-slate-100 dark:bg-white/[0.04]"
              >
            </div>

            <div v-else class="px-2.5 py-2.5">
              <div class="flex items-start gap-2">
                <div class="w-8 h-8 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-500 dark:text-zinc-400">
                  <Icon :name="fileIcon(attachment.mimeType)" class="w-4 h-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">{{ attachment.name }}</p>
                  <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{{ formatBytes(attachment.sizeBytes) }}</p>
                </div>
              </div>
            </div>

            <div class="px-2.5 py-2 border-t border-slate-100 dark:border-white/[0.06]">
              <div class="flex items-center justify-between gap-2 text-[11px]">
                <span class="truncate text-slate-600 dark:text-zinc-300">{{ attachment.name }}</span>
                <span
                  v-if="attachment.uploading"
                  class="text-blue-600 dark:text-blue-300"
                >{{ attachment.progress }}%</span>
                <span
                  v-else-if="attachment.error"
                  class="text-rose-600 dark:text-rose-400"
                >Failed</span>
                <span
                  v-else
                  class="text-emerald-600 dark:text-emerald-400"
                >Ready</span>
              </div>
              <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{{ formatBytes(attachment.sizeBytes) }}</p>
              <div v-if="attachment.uploading" class="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
                <div class="h-full bg-blue-500 transition-all duration-200" :style="{ width: `${attachment.progress}%` }" />
              </div>
              <p v-if="attachment.error" class="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{{ attachment.error }}</p>
            </div>
          </article>
        </div>
      </div>

      <p v-if="uploadError" class="mt-2 text-xs text-rose-600 dark:text-rose-400">
        {{ uploadError }}
      </p>

      <p v-if="!hideHelper" class="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
        Type <kbd class="px-1 py-0.5 bg-slate-100 dark:bg-dm-card rounded text-[10px] font-mono">@</kbd> to mention someone
        <span class="mx-1">·</span>
        Drop files, paste images, or use the paperclip
      </p>
    </div>
  </div>
</template>
