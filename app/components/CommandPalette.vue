<script setup lang="ts">
const router = useRouter()
const { workspaceId } = useItems()

const open = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)

const results = ref<{
  items: any[]
  channels: any[]
  members: any[]
}>({ items: [], channels: [], members: [] })

// All results flattened for keyboard navigation
const flatResults = computed(() => {
  const flat: { type: string; data: any }[] = []
  for (const item of results.value.items) flat.push({ type: 'item', data: item })
  for (const ch of results.value.channels) flat.push({ type: 'channel', data: ch })
  for (const m of results.value.members) flat.push({ type: 'member', data: m })
  return flat
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const doSearch = async () => {
  const q = query.value.trim()
  if (!q || q.length < 2 || !workspaceId.value) {
    results.value = { items: [], channels: [], members: [] }
    return
  }

  loading.value = true
  try {
    results.value = await $fetch('/api/search', {
      query: { q, workspaceId: workspaceId.value }
    })
  } catch (e) {
    console.error('Search failed:', e)
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  selectedIndex.value = 0
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(doSearch, 200)
})

// Open/close
const toggle = () => {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    results.value = { items: [], channels: [], members: [] }
    nextTick(() => searchInput.value?.focus())
  }
}

// Global keyboard shortcut
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    toggle()
  }
  if (e.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// Keyboard navigation inside palette
const handleInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, flatResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const selected = flatResults.value[selectedIndex.value]
    if (selected) selectResult(selected)
  }
}

// Navigate to selected result
const selectResult = (result: { type: string; data: any }) => {
  open.value = false

  if (result.type === 'item') {
    if (result.data.isProject) {
      router.push(`/workspace/projects/${result.data.id}`)
    } else {
      // Task: go to parent project
      const projectId = result.data.projectId || result.data.id
      router.push(`/workspace/projects/${projectId}`)
    }
  } else if (result.type === 'channel') {
    router.push(`/workspace/channels/${result.data.id}`)
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DONE': return 'bg-emerald-400'
    case 'IN_PROGRESS': return 'bg-blue-400'
    case 'BLOCKED': return 'bg-red-400'
    case 'PAUSED': return 'bg-amber-400'
    default: return 'bg-slate-300 dark:bg-zinc-500'
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
        @click="open = false"
      />
    </Transition>

    <Transition name="slide-down">
      <div
        v-if="open"
        class="fixed top-[15%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-xl"
      >
        <div class="bg-white dark:bg-[#1a1a1f] rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
          <!-- Search input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
            <Icon name="heroicons:magnifying-glass" class="w-5 h-5 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="Search projects, tasks, channels..."
              class="flex-1 text-sm bg-transparent border-0 outline-none placeholder-slate-400 dark:placeholder-zinc-500 text-slate-900 dark:text-zinc-200"
              @keydown="handleInputKeydown"
            />
            <kbd class="text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">ESC</kbd>
          </div>

          <!-- Results -->
          <div class="max-h-[360px] overflow-y-auto">
            <!-- Loading -->
            <div v-if="loading" class="px-4 py-6 text-center text-sm text-slate-400 dark:text-zinc-500">
              Searching...
            </div>

            <!-- Empty state -->
            <div v-else-if="query.length >= 2 && !flatResults.length" class="px-4 py-6 text-center text-sm text-slate-400 dark:text-zinc-500">
              No results for "{{ query }}"
            </div>

            <!-- Default state -->
            <div v-else-if="query.length < 2" class="px-4 py-6 text-center text-sm text-slate-400 dark:text-zinc-500">
              Type to search across your workspace
            </div>

            <template v-else>
              <!-- Items -->
              <div v-if="results.items.length">
                <div class="px-3 pt-3 pb-1 text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  Projects & Tasks
                </div>
                <button
                  v-for="(item, i) in results.items"
                  :key="item.id"
                  @click="selectResult({ type: 'item', data: item })"
                  :class="[
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    flatResults.indexOf(flatResults.find(r => r.type === 'item' && r.data.id === item.id)!) === selectedIndex
                      ? 'bg-slate-100 dark:bg-white/[0.08]'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  ]"
                >
                  <div
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    :class="getStatusColor(item.status)"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-slate-900 dark:text-zinc-200 truncate">{{ item.title }}</div>
                    <div v-if="item.parentTitle" class="text-xs text-slate-400 dark:text-zinc-500 truncate">
                      in {{ item.parentTitle }}
                    </div>
                  </div>
                  <span class="text-[10px] text-slate-400 dark:text-zinc-500 flex-shrink-0">
                    {{ item.isProject ? 'Project' : 'Task' }}
                  </span>
                </button>
              </div>

              <!-- Channels -->
              <div v-if="results.channels.length">
                <div class="px-3 pt-3 pb-1 text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  Channels
                </div>
                <button
                  v-for="ch in results.channels"
                  :key="ch.id"
                  @click="selectResult({ type: 'channel', data: ch })"
                  :class="[
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    flatResults.indexOf(flatResults.find(r => r.type === 'channel' && r.data.id === ch.id)!) === selectedIndex
                      ? 'bg-slate-100 dark:bg-white/[0.08]'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  ]"
                >
                  <Icon
                    :name="ch.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'"
                    class="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0"
                  />
                  <span class="text-sm text-slate-900 dark:text-zinc-200 truncate">{{ ch.name }}</span>
                </button>
              </div>

              <!-- Members -->
              <div v-if="results.members.length">
                <div class="px-3 pt-3 pb-1 text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  People
                </div>
                <div
                  v-for="m in results.members"
                  :key="m.id"
                  :class="[
                    'flex items-center gap-3 px-3 py-2 transition-colors',
                    flatResults.indexOf(flatResults.find(r => r.type === 'member' && r.data.id === m.id)!) === selectedIndex
                      ? 'bg-slate-100 dark:bg-white/[0.08]'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  ]"
                >
                  <div class="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <span class="text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                      {{ (m.name || m.email)?.[0]?.toUpperCase() || '?' }}
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm text-slate-900 dark:text-zinc-200 truncate">{{ m.name || m.email }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="px-4 py-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-4 text-[10px] text-slate-400 dark:text-zinc-500">
            <span class="flex items-center gap-1">
              <kbd class="bg-slate-100 dark:bg-white/[0.06] px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate
            </span>
            <span class="flex items-center gap-1">
              <kbd class="bg-slate-100 dark:bg-white/[0.06] px-1 py-0.5 rounded font-mono">↵</kbd> open
            </span>
            <span class="flex items-center gap-1">
              <kbd class="bg-slate-100 dark:bg-white/[0.06] px-1 py-0.5 rounded font-mono">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 150ms ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
