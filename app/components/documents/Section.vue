<script setup lang="ts">
import type { DocumentSummary } from '~/types'

const props = defineProps<{
  itemId: string | null
  title?: string
  compact?: boolean
  showHeader?: boolean
  showHelper?: boolean
  showNewButton?: boolean
  newButtonLabel?: string
  emptyMessage?: string
  gridCols?: string
}>()

const documents = ref<DocumentSummary[]>([])
const isLoading = ref(false)
const activeDocumentId = ref<string | null>(null)
const showModal = ref(false)

const { currentUserId } = useFocus()

const fetchDocuments = async () => {
  if (!props.itemId) {
    documents.value = []
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch('/api/documents', {
      query: { itemId: props.itemId },
    })
    documents.value = (data as DocumentSummary[]) ?? []
  } catch (e) {
    console.error('Failed to fetch documents:', e)
    documents.value = []
  } finally {
    isLoading.value = false
  }
}

watch(() => props.itemId, () => {
  fetchDocuments()
}, { immediate: true })

const openDocument = (docId: string) => {
  activeDocumentId.value = docId
  showModal.value = true
}

const closeDocument = () => {
  showModal.value = false
  activeDocumentId.value = null
  fetchDocuments()
}

const handleUpdated = () => {
  fetchDocuments()
}

const createDocument = async () => {
  if (!props.itemId) return

  try {
    const created = await $fetch('/api/documents', {
      method: 'POST',
      body: {
        itemId: props.itemId,
        title: 'Untitled document',
        userId: currentUserId.value,
      },
    })
    await fetchDocuments()
    if (created?.id) {
      openDocument(created.id)
    }
  } catch (e) {
    console.error('Failed to create document:', e)
  }
}

// Import markdown on creation
const showImportModal = ref(false)
const importTab = ref<'file' | 'paste'>('file')
const importPasteContent = ref('')

const openImportModal = () => {
  importTab.value = 'file'
  importPasteContent.value = ''
  showImportModal.value = true
}

const handleImportFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    createDocumentFromMarkdown(reader.result as string)
    input.value = ''
  }
  reader.readAsText(file)
}

const handleImportPaste = () => {
  if (!importPasteContent.value.trim()) return
  createDocumentFromMarkdown(importPasteContent.value)
}

const createDocumentFromMarkdown = async (markdown: string) => {
  if (!props.itemId) return

  // Extract title from first heading if present
  const lines = markdown.split('\n')
  const firstLine = lines[0]?.trim()
  let title = 'Untitled document'
  let content = markdown

  if (firstLine?.startsWith('# ')) {
    title = firstLine.slice(2).trim()
    content = lines.slice(1).join('\n').replace(/^\n+/, '')
  }

  try {
    const created = await $fetch('/api/documents', {
      method: 'POST',
      body: {
        itemId: props.itemId,
        title,
        content,
        userId: currentUserId.value,
      },
    })
    showImportModal.value = false
    importPasteContent.value = ''
    await fetchDocuments()
    if (created?.id) {
      openDocument(created.id)
    }
  } catch (e) {
    console.error('Failed to create document from import:', e)
  }
}

defineExpose({
  createDocument,
  openDocument,
})

const formatRelativeTime = (dateString?: string | null) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Get initials for document avatar
const getDocInitials = (title: string) => {
  if (!title || title === 'Untitled document') return 'U'
  return title.charAt(0).toUpperCase()
}

// Subtle color based on document id
const getDocColor = (id: string) => {
  const colors = [
    'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
    'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  ]
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
</script>

<template>
  <div>
    <!-- Compact Header (for modal) -->
    <div v-if="compact" class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-slate-700 dark:text-zinc-300">
        Documents
        <span v-if="documents.length" class="text-slate-400 font-normal">({{ documents.length }})</span>
      </h3>
      <div class="flex items-center gap-2">
        <button
          v-if="itemId && showNewButton !== false"
          @click="openImportModal"
          class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
          title="Import Markdown"
        >
          <Icon name="heroicons:arrow-up-tray" class="w-3.5 h-3.5" />
          Import
        </button>
        <button
          v-if="itemId && showNewButton !== false"
          @click="createDocument"
          class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
        >
          <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
          Add
        </button>
      </div>
    </div>

    <!-- Full Header -->
    <div v-else-if="showHeader !== false" class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-dm-card dark:to-white/[0.08] flex items-center justify-center">
          <Icon name="heroicons:document-text" class="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            {{ title || 'Documents' }}
            <span v-if="documents.length" class="text-slate-400 font-normal ml-1">({{ documents.length }})</span>
          </h3>
          <p v-if="showHelper !== false" class="text-[11px] text-slate-400 mt-0.5">Docs live only on this level</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="itemId && showNewButton !== false"
          @click="openImportModal"
          class="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all"
          title="Import Markdown"
        >
          <Icon name="heroicons:arrow-up-tray" class="w-3.5 h-3.5" />
          Import
        </button>
        <button
          v-if="itemId && showNewButton !== false"
          @click="createDocument"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 transition-all"
        >
          <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
          {{ newButtonLabel || 'New doc' }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div v-if="!itemId" class="text-xs text-slate-400 py-6 text-center">
      Select an item to see its documents.
    </div>

    <!-- Compact Loading -->
    <div v-else-if="isLoading && compact" class="space-y-2">
      <div v-for="i in 2" :key="i" class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-dm-card rounded-lg">
        <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.08] animate-pulse flex-shrink-0" />
        <div class="flex-1 space-y-1.5">
          <div class="h-3.5 w-32 rounded bg-slate-100 dark:bg-white/[0.08] animate-pulse" />
          <div class="h-2.5 w-20 rounded bg-slate-100 dark:bg-white/[0.08] animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Full Loading -->
    <div v-else-if="isLoading" :class="['grid gap-4', gridCols || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3']">
      <div v-for="i in 3" :key="i" class="bg-white dark:bg-dm-card rounded-xl border border-slate-100 dark:border-white/[0.06] p-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.08] animate-pulse flex-shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-24 rounded bg-slate-100 dark:bg-white/[0.08] animate-pulse" />
            <div class="h-3 w-16 rounded bg-slate-50 dark:bg-white/[0.08] animate-pulse" />
          </div>
        </div>
      </div>
    </div>

    <!-- Compact Empty State -->
    <div v-else-if="documents.length === 0 && compact" class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-dm-card rounded-lg border border-dashed border-slate-200 dark:border-white/[0.06]">
      <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0">
        <Icon name="heroicons:document-plus" class="w-4 h-4 text-slate-300" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-slate-400">No documents yet</p>
      </div>
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] transition-colors"
      >
        <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
        Create
      </button>
    </div>

    <!-- Full Empty State -->
    <div v-else-if="documents.length === 0" class="bg-white dark:bg-dm-card rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06] py-10 text-center">
      <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/[0.08] flex items-center justify-center mx-auto mb-3">
        <Icon name="heroicons:document-plus" class="w-6 h-6 text-slate-300" />
      </div>
      <p class="text-sm text-slate-500 dark:text-zinc-400 font-medium">No documents yet</p>
      <p class="text-xs text-slate-400 mt-1">{{ emptyMessage || 'Create your first document' }}</p>
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
      >
        <Icon name="heroicons:plus" class="w-4 h-4" />
        Create document
      </button>
    </div>

    <!-- Compact Document List (rows) -->
    <div v-else-if="compact" class="space-y-2">
      <button
        v-for="doc in documents"
        :key="doc.id"
        @click="openDocument(doc.id)"
        class="group w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-dm-card hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg text-left transition-colors"
      >
        <!-- Document icon/avatar -->
        <div
          :class="[
            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0',
            getDocColor(doc.id)
          ]"
        >
          {{ getDocInitials(doc.title) }}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-700 dark:text-zinc-300 truncate group-hover:text-slate-900 dark:group-hover:text-zinc-100">{{ doc.title }}</span>
            <span
              v-if="doc.isLocked"
              class="inline-flex items-center text-[10px] px-1 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded flex-shrink-0"
            >
              <Icon name="heroicons:lock-closed" class="w-2.5 h-2.5" />
            </span>
          </div>
          <div class="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>{{ formatRelativeTime(doc.updatedAt) }}</span>
            <span v-if="doc.createdBy" class="text-slate-300 dark:text-zinc-600">·</span>
            <span v-if="doc.createdBy" class="truncate">{{ doc.createdBy.name }}</span>
            <template v-if="doc.versionCount > 0">
              <span class="text-slate-300 dark:text-zinc-600">·</span>
              <span>{{ doc.versionCount }} {{ doc.versionCount === 1 ? 'ver' : 'vers' }}</span>
            </template>
          </div>
        </div>

        <!-- Arrow -->
        <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-slate-400 dark:group-hover:text-zinc-500 flex-shrink-0" />
      </button>
    </div>

    <!-- Full Document Grid -->
    <div v-else :class="['grid gap-4', gridCols || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4']">
      <!-- Document cards -->
      <button
        v-for="doc in documents"
        :key="doc.id"
        @click="openDocument(doc.id)"
        class="group bg-white dark:bg-dm-card rounded-xl border border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.1] hover:shadow-sm p-4 text-left transition-all"
      >
        <div class="flex items-start gap-3">
          <!-- Document icon/avatar -->
          <div
            :class="[
              'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-transform group-hover:scale-105',
              getDocColor(doc.id)
            ]"
          >
            {{ getDocInitials(doc.title) }}
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate group-hover:text-slate-900 dark:group-hover:text-zinc-100">{{ doc.title }}</span>
              <span
                v-if="doc.isLocked"
                class="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex-shrink-0"
              >
                <Icon name="heroicons:lock-closed" class="w-2.5 h-2.5" />
              </span>
              <span class="flex-1" />
            </div>
            <div class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>{{ formatRelativeTime(doc.updatedAt) }}</span>
              <span v-if="doc.createdBy" class="text-slate-300 dark:text-zinc-600">·</span>
              <span v-if="doc.createdBy" class="truncate">{{ doc.createdBy.name }}</span>
            </div>
          </div>
        </div>
      </button>

      <!-- New document card -->
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="flex flex-col items-center justify-center min-h-[100px] bg-slate-50/50 dark:bg-white/[0.04] rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group"
      >
        <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.08] group-hover:bg-slate-200 dark:group-hover:bg-white/[0.08] flex items-center justify-center mb-1.5 transition-colors">
          <Icon name="heroicons:plus" class="w-4 h-4 text-slate-400 group-hover:text-slate-500" />
        </div>
        <span class="text-xs text-slate-400 group-hover:text-slate-500">New document</span>
      </button>
    </div>
  </div>

  <DocumentsDocumentModal
    :open="showModal"
    :document-id="activeDocumentId"
    @close="closeDocument"
    @updated="handleUpdated"
    @deleted="closeDocument"
  />

  <!-- Import Markdown Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" @click="showImportModal = false" />
        <div class="relative bg-white dark:bg-dm-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <h3 class="text-base font-semibold text-slate-800 dark:text-zinc-100">Import Markdown</h3>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              @click="showImportModal = false"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 space-y-4">
            <!-- Tab selector -->
            <div class="flex items-center bg-slate-100 dark:bg-white/[0.08] rounded-lg p-0.5">
              <button
                @click="importTab = 'file'"
                :class="[
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  importTab === 'file' ? 'bg-white dark:bg-dm-card text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                ]"
              >
                <Icon name="heroicons:document-arrow-up" class="w-3.5 h-3.5" />
                From file
              </button>
              <button
                @click="importTab = 'paste'"
                :class="[
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  importTab === 'paste' ? 'bg-white dark:bg-dm-card text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                ]"
              >
                <Icon name="heroicons:clipboard-document" class="w-3.5 h-3.5" />
                Paste text
              </button>
            </div>

            <!-- File upload tab -->
            <div v-if="importTab === 'file'">
              <label
                class="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <Icon name="heroicons:arrow-up-tray" class="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                <span class="text-sm text-slate-500 dark:text-zinc-400">Choose a .md or .txt file</span>
                <span class="text-xs text-slate-400 dark:text-zinc-500">or drag and drop</span>
                <input
                  type="file"
                  accept=".md,.markdown,.txt,.text"
                  class="hidden"
                  @change="handleImportFile"
                />
              </label>
              <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">A new document will be created from the imported file.</p>
            </div>

            <!-- Paste tab -->
            <div v-if="importTab === 'paste'">
              <textarea
                v-model="importPasteContent"
                rows="10"
                class="w-full text-sm border border-slate-200 dark:border-white/[0.06] dark:bg-dm-surface dark:text-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 focus:border-slate-300 dark:focus:border-zinc-600 transition-all resize-none font-mono"
                placeholder="Paste your markdown content here..."
              />
              <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">A new document will be created from the pasted content.</p>
            </div>
          </div>

          <div v-if="importTab === 'paste'" class="px-5 py-4 bg-slate-50 dark:bg-white/[0.04] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
            <button
              class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
              @click="showImportModal = false"
            >
              Cancel
            </button>
            <button
              :disabled="!importPasteContent.trim()"
              class="px-5 py-2 text-sm font-medium rounded-xl bg-slate-900 dark:bg-white/[0.1] text-white dark:text-zinc-200 hover:bg-slate-800 dark:hover:bg-white/[0.15] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              @click="handleImportPaste"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
