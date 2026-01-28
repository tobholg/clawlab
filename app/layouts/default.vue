<script setup lang="ts">
const navigation = [
  { name: 'Dashboard', href: '/', icon: 'heroicons:home' },
  { name: 'Kanban', href: '/kanban', icon: 'heroicons:view-columns' },
  { name: 'Timeline', href: '/timeline', icon: 'heroicons:calendar' },
  { name: 'Dependencies', href: '/dependencies', icon: 'heroicons:arrow-path' },
]

const route = useRoute()

// Focus state
const { currentFocus, clearFocus, focusDuration, loadCurrentFocus } = useFocus()

// Load focus state on mount
onMounted(() => {
  loadCurrentFocus()
})

// Update duration every minute
const durationDisplay = ref('')
let durationInterval: ReturnType<typeof setInterval> | null = null

watch(currentFocus, (focus) => {
  if (durationInterval) clearInterval(durationInterval)
  
  if (focus) {
    const updateDuration = () => {
      const now = new Date()
      const started = new Date(focus.startedAt)
      const diffMs = now.getTime() - started.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      
      if (diffMins < 60) {
        durationDisplay.value = `${diffMins}m`
      } else {
        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        durationDisplay.value = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
      }
    }
    updateDuration()
    durationInterval = setInterval(updateDuration, 60000)
  }
}, { immediate: true })

onUnmounted(() => {
  if (durationInterval) clearInterval(durationInterval)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <aside class="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
      <!-- Logo -->
      <div class="flex items-center h-16 px-6 border-b border-gray-200">
        <span class="text-xl font-bold text-relai-600">Relai</span>
      </div>

      <!-- Navigation -->
      <nav class="p-4 space-y-1">
        <NuxtLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="route.path === item.href 
            ? 'bg-relai-50 text-relai-700' 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Icon :name="item.icon" class="w-5 h-5" />
          {{ item.name }}
        </NuxtLink>
      </nav>

      <!-- Project selector (placeholder) -->
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <div class="w-8 h-8 rounded-lg bg-relai-100 flex items-center justify-center">
            <span class="text-relai-600 font-medium">R</span>
          </div>
          <div class="flex-1 text-left">
            <div class="font-medium text-gray-900">Relai</div>
            <div class="text-xs text-gray-500">3 active projects</div>
          </div>
          <Icon name="heroicons:chevron-up-down" class="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="pl-64">
      <!-- Top bar -->
      <header class="sticky top-0 z-10 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div class="flex items-center gap-4">
          <h1 class="text-lg font-semibold text-gray-900">
            {{ route.meta.title || 'Dashboard' }}
          </h1>
        </div>

        <div class="flex items-center gap-4">
          <!-- Current Focus Indicator -->
          <div 
            v-if="currentFocus" 
            class="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full"
          >
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span class="text-sm font-medium text-amber-700 max-w-[200px] truncate">
              {{ currentFocus.itemTitle }}
            </span>
            <span class="text-xs text-amber-500">{{ durationDisplay }}</span>
            <button 
              @click="clearFocus"
              class="p-0.5 rounded hover:bg-amber-100 text-amber-400 hover:text-amber-600 transition-colors"
              title="End focus session"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4" />
            </button>
          </div>

          <!-- Search -->
          <div class="relative">
            <Icon name="heroicons:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search tasks..."
              class="pl-9 pr-4 py-2 w-64 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-relai-500 focus:border-transparent"
            />
          </div>

          <!-- User -->
          <button class="w-8 h-8 rounded-full bg-relai-500 flex items-center justify-center">
            <span class="text-sm text-white font-medium">T</span>
          </button>
        </div>
      </header>

      <!-- Page content -->
      <div class="p-6">
        <slot />
      </div>
    </main>
  </div>
</template>
