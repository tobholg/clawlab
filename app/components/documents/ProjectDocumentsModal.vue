<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = defineProps<{
  open: boolean
  project: ItemNode | null
  isProject?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type DocEntry = {
  id: string
  itemId: string
  title: string
  isLocked: boolean
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; avatar: string | null } | null
  lastEditedBy: { id: string; name: string; avatar: string | null } | null
  versionCount: number
}

type TaskDocGroup = {
  itemId: string
  itemTitle: string
  docs: DocEntry[]
}

const isLoading = ref(false)
const ownDocs = ref<DocEntry[]>([])
const childDocs = ref<TaskDocGroup[]>([])
const collapsedGroups = ref<Set<string>>(new Set())

const activeDocumentId = ref<string | null>(null)
const showDocModal = ref(false)

const isProjectLevel = computed(() => props.isProject ?? !props.project?.parentId)
const ownDocsLabel = computed(() => isProjectLevel.value ? 'Project docs' : 'Task docs')

const fetchDocs = async () => {
  if (!props.project?.id) return
  isLoading.value = true
  try {
    const queryParam = isProjectLevel.value
      ? { projectId: props.project.id }
      : { itemId: props.project.id }
    const data = await $fetch<{ projectDocs: DocEntry[]; taskDocs: TaskDocGroup[] }>('/api/documents/by-project', {
      query: queryParam,
    })
    ownDocs.value = data.projectDocs
    childDocs.value = data.taskDocs
  } catch (e) {
    console.error('Failed to fetch documents:', e)
    ownDocs.value = []
    childDocs.value = []
  } finally {
    isLoading.value = false
  }
}

watch(() => props.open, (val) => {
  if (val) {
    collapsedGroups.value.clear()
    fetchDocs()
  }
})

const totalCount = computed(() => {
  return ownDocs.value.length + childDocs.value.reduce((sum, g) => sum + g.docs.length, 0)
})

const toggleGroup = (itemId: string) => {
  if (collapsedGroups.value.has(itemId)) {
    collapsedGroups.value.delete(itemId)
  } else {
    collapsedGroups.value.add(itemId)
  }
}

const openDocument = (docId: string) => {
  activeDocumentId.value = docId
  showDocModal.value = true
}

const closeDocument = () => {
  showDocModal.value = false
  activeDocumentId.value = null
  fetchDocs()
}

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

const getDocInitials = (title: string) => {
  if (!title || title === 'Untitled document') return 'U'
  return title.charAt(0).toUpperCase()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50" @mousedown.self="emit('close')">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" />

        <!-- Modal -->
        <div class="absolute inset-0 flex items-center justify-center p-4" @mousedown.self="emit('close')">
          <Transition
            enter-active-class="duration-200 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="duration-150 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="open"
              class="relative bg-white dark:bg-dm-panel rounded-2xl shadow-2xl dark:shadow-black/40 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-slate-200/60 dark:border-white/[0.06]"
            >
              <!-- Header -->
              <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-white/[0.08] dark:to-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Icon name="heroicons:document-text" class="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  </div>
                  <div class="min-w-0">
                    <h2 class="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      Documents
                    </h2>
                    <p class="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                      {{ project?.title }}
                      <span v-if="!isLoading"> &middot; {{ totalCount }} {{ totalCount === 1 ? 'doc' : 'docs' }}</span>
                    </p>
                  </div>
                </div>
                <button
                  @click="emit('close')"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
                >
                  <Icon name="heroicons:x-mark" class="w-5 h-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="flex-1 overflow-y-auto px-5 py-4">
                <!-- Loading -->
                <div v-if="isLoading" class="space-y-3">
                  <div v-for="i in 4" :key="i" class="flex items-center gap-3 p-3 rounded-lg">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.08] animate-pulse flex-shrink-0" />
                    <div class="flex-1 space-y-1.5">
                      <div class="h-3.5 w-32 rounded bg-slate-100 dark:bg-white/[0.08] animate-pulse" />
                      <div class="h-2.5 w-20 rounded bg-slate-100 dark:bg-white/[0.08] animate-pulse" />
                    </div>
                  </div>
                </div>

                <!-- Empty state -->
                <div v-else-if="totalCount === 0" class="py-10 text-center">
                  <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/[0.08] flex items-center justify-center mx-auto mb-3">
                    <Icon name="heroicons:document-text" class="w-6 h-6 text-slate-300 dark:text-zinc-600" />
                  </div>
                  <p class="text-sm text-slate-500 dark:text-zinc-400">No documents found</p>
                  <p class="text-xs text-slate-400 dark:text-zinc-500 mt-1">Documents added to {{ isProjectLevel ? 'tasks' : 'subtasks' }} will appear here</p>
                </div>

                <!-- Documents -->
                <div v-else class="space-y-5">
                  <!-- Own docs -->
                  <div v-if="ownDocs.length > 0">
                    <h3 class="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                      {{ ownDocsLabel }} ({{ ownDocs.length }})
                    </h3>
                    <div class="space-y-1">
                      <button
                        v-for="doc in ownDocs"
                        :key="doc.id"
                        @click="openDocument(doc.id)"
                        class="group w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg text-left transition-colors"
                      >
                        <div
                          :class="[
                            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0',
                            getDocColor(doc.id)
                          ]"
                        >
                          {{ getDocInitials(doc.title) }}
                        </div>
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
                          <div class="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
                            <span>{{ formatRelativeTime(doc.updatedAt) }}</span>
                            <template v-if="doc.createdBy">
                              <span class="text-slate-300 dark:text-zinc-600">&middot;</span>
                              <span class="truncate">{{ doc.createdBy.name }}</span>
                            </template>
                          </div>
                        </div>
                        <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-slate-400 dark:group-hover:text-zinc-500 flex-shrink-0" />
                      </button>
                    </div>
                  </div>

                  <!-- Child docs -->
                  <div v-if="childDocs.length > 0">
                    <h3 class="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                      {{ isProjectLevel ? 'Task' : 'Subtask' }} documents
                    </h3>
                    <div class="space-y-2">
                      <div v-for="group in childDocs" :key="group.itemId">
                        <!-- Group header -->
                        <button
                          @click="toggleGroup(group.itemId)"
                          class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
                        >
                          <Icon
                            name="heroicons:chevron-right"
                            class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform flex-shrink-0"
                            :class="{ 'rotate-90': !collapsedGroups.has(group.itemId) }"
                          />
                          <span class="text-xs font-medium text-slate-600 dark:text-zinc-300 truncate">{{ group.itemTitle }}</span>
                          <span class="text-[10px] text-slate-400 dark:text-zinc-500 flex-shrink-0">({{ group.docs.length }})</span>
                        </button>

                        <!-- Group docs -->
                        <div v-if="!collapsedGroups.has(group.itemId)" class="ml-5 space-y-1">
                          <button
                            v-for="doc in group.docs"
                            :key="doc.id"
                            @click="openDocument(doc.id)"
                            class="group w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg text-left transition-colors"
                          >
                            <div
                              :class="[
                                'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold flex-shrink-0',
                                getDocColor(doc.id)
                              ]"
                            >
                              {{ getDocInitials(doc.title) }}
                            </div>
                            <div class="flex-1 min-w-0">
                              <span class="text-sm font-medium text-slate-700 dark:text-zinc-300 truncate group-hover:text-slate-900 dark:group-hover:text-zinc-100 block">{{ doc.title }}</span>
                              <div class="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
                                <span>{{ formatRelativeTime(doc.updatedAt) }}</span>
                                <template v-if="doc.createdBy">
                                  <span class="text-slate-300 dark:text-zinc-600">&middot;</span>
                                  <span class="truncate">{{ doc.createdBy.name }}</span>
                                </template>
                              </div>
                            </div>
                            <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-slate-400 dark:group-hover:text-zinc-500 flex-shrink-0" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>

  <DocumentsDocumentModal
    :open="showDocModal"
    :document-id="activeDocumentId"
    @close="closeDocument"
    @updated="fetchDocs"
    @deleted="closeDocument"
  />
</template>
