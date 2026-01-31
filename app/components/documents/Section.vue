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
    'bg-blue-50 text-blue-600',
    'bg-emerald-50 text-emerald-600',
    'bg-violet-50 text-violet-600',
    'bg-rose-50 text-rose-600',
    'bg-amber-50 text-amber-600',
    'bg-cyan-50 text-cyan-600',
  ]
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
</script>

<template>
  <div>
    <!-- Compact Header (for modal) -->
    <div v-if="compact" class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-slate-700">
        Documents
        <span v-if="documents.length" class="text-slate-400 font-normal">({{ documents.length }})</span>
      </h3>
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
        Add
      </button>
    </div>

    <!-- Full Header -->
    <div v-else-if="showHeader !== false" class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
          <Icon name="heroicons:document-text" class="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-slate-800">
            {{ title || 'Documents' }}
            <span v-if="documents.length" class="text-slate-400 font-normal ml-1">({{ documents.length }})</span>
          </h3>
          <p v-if="showHelper !== false" class="text-[11px] text-slate-400 mt-0.5">Docs live only on this level</p>
        </div>
      </div>

      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-all"
      >
        <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
        {{ newButtonLabel || 'New doc' }}
      </button>
    </div>

    <!-- Content -->
    <div v-if="!itemId" class="text-xs text-slate-400 py-6 text-center">
      Select an item to see its documents.
    </div>

    <!-- Compact Loading -->
    <div v-else-if="isLoading && compact" class="space-y-2">
      <div v-for="i in 2" :key="i" class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <div class="w-8 h-8 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
        <div class="flex-1 space-y-1.5">
          <div class="h-3.5 w-32 rounded bg-slate-100 animate-pulse" />
          <div class="h-2.5 w-20 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Full Loading -->
    <div v-else-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="bg-white rounded-xl border border-slate-100 p-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-24 rounded bg-slate-100 animate-pulse" />
            <div class="h-3 w-16 rounded bg-slate-50 animate-pulse" />
          </div>
        </div>
      </div>
    </div>

    <!-- Compact Empty State -->
    <div v-else-if="documents.length === 0 && compact" class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
      <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon name="heroicons:document-plus" class="w-4 h-4 text-slate-300" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-slate-400">No documents yet</p>
      </div>
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
      >
        <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
        Create
      </button>
    </div>

    <!-- Full Empty State -->
    <div v-else-if="documents.length === 0" class="bg-white rounded-xl border border-dashed border-slate-200 py-10 text-center">
      <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
        <Icon name="heroicons:document-plus" class="w-6 h-6 text-slate-300" />
      </div>
      <p class="text-sm text-slate-500 font-medium">No documents yet</p>
      <p class="text-xs text-slate-400 mt-1">{{ emptyMessage || 'Create your first document' }}</p>
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
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
        class="group w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors"
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
            <span class="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900">{{ doc.title }}</span>
            <span
              v-if="doc.isLocked"
              class="inline-flex items-center text-[10px] px-1 py-0.5 bg-amber-50 text-amber-600 rounded flex-shrink-0"
            >
              <Icon name="heroicons:lock-closed" class="w-2.5 h-2.5" />
            </span>
          </div>
          <div class="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>{{ formatRelativeTime(doc.updatedAt) }}</span>
            <span v-if="doc.createdBy" class="text-slate-300">·</span>
            <span v-if="doc.createdBy" class="truncate">{{ doc.createdBy.name }}</span>
            <template v-if="doc.versionCount > 0">
              <span class="text-slate-300">·</span>
              <span>{{ doc.versionCount }} {{ doc.versionCount === 1 ? 'ver' : 'vers' }}</span>
            </template>
          </div>
        </div>

        <!-- Arrow -->
        <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0" />
      </button>
    </div>

    <!-- Full Document Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Document cards -->
      <button
        v-for="doc in documents"
        :key="doc.id"
        @click="openDocument(doc.id)"
        class="group bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm p-4 text-left transition-all"
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
              <span class="text-sm font-medium text-slate-800 truncate group-hover:text-slate-900">{{ doc.title }}</span>
              <span
                v-if="doc.isLocked"
                class="inline-flex items-center text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full flex-shrink-0"
              >
                <Icon name="heroicons:lock-closed" class="w-2.5 h-2.5" />
              </span>
            </div>
            <div class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>{{ formatRelativeTime(doc.updatedAt) }}</span>
              <span v-if="doc.createdBy" class="text-slate-300">·</span>
              <span v-if="doc.createdBy" class="truncate">{{ doc.createdBy.name }}</span>
            </div>
            <div v-if="doc.versionCount > 0" class="mt-2">
              <span class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                {{ doc.versionCount }} {{ doc.versionCount === 1 ? 'version' : 'versions' }}
              </span>
            </div>
          </div>
        </div>
      </button>

      <!-- New document card -->
      <button
        v-if="itemId && showNewButton !== false"
        @click="createDocument"
        class="flex flex-col items-center justify-center min-h-[100px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
      >
        <div class="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center mb-1.5 transition-colors">
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
</template>
