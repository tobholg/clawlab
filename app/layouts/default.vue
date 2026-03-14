<script setup lang="ts">
const navigation = [
  { name: 'Dashboard', href: '/', icon: 'heroicons:home' },
  { name: 'Kanban', href: '/kanban', icon: 'heroicons:view-columns' },
  { name: 'Timeline', href: '/timeline', icon: 'heroicons:calendar' },
  { name: 'Dependencies', href: '/dependencies', icon: 'heroicons:arrow-path' },
]

const route = useRoute()

// Workspace ID (will come from route/state)
const currentWorkspaceId = ref('demo-workspace')
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <aside class="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
      <!-- Logo -->
      <div class="flex items-center h-16 px-6 border-b border-gray-200 flex-shrink-0">
        <span class="text-xl font-bold text-clawlab-600">ClawLab</span>
      </div>

      <!-- Focus Section -->
      <FocusSidebar />
      
      <!-- Navigation -->
      <nav class="p-4 space-y-1 flex-shrink-0">
        <NuxtLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="route.path === item.href 
            ? 'bg-clawlab-50 text-clawlab-700' 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Icon :name="item.icon" class="w-5 h-5" />
          {{ item.name }}
        </NuxtLink>
      </nav>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Workspace selector -->
      <div class="p-4 border-t border-gray-200 flex-shrink-0">
        <button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <div class="w-8 h-8 rounded-lg bg-clawlab-100 flex items-center justify-center">
            <svg class="w-4 h-4" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="flex-1 text-left">
            <div class="font-medium text-gray-900">ClawLab</div>
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
          <!-- Search -->
          <div class="relative">
            <Icon name="heroicons:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search tasks..."
              class="pl-9 pr-4 py-2 w-64 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clawlab-500 focus:border-transparent"
            />
          </div>

          <!-- User -->
          <button class="w-8 h-8 rounded-full bg-clawlab-500 flex items-center justify-center">
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
