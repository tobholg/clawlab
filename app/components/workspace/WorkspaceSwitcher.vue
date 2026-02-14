<script setup lang="ts">
const { workspaces, currentWorkspaceId, currentWorkspace, isOrgAdmin, switchWorkspace, fetchWorkspaces } = useWorkspaces()

const showDropdown = ref(false)
const showCreateModal = ref(false)

const toggle = () => {
  showDropdown.value = !showDropdown.value
}

const router = useRouter()

const selectWorkspace = (id: string) => {
  switchWorkspace(id)
  showDropdown.value = false
  router.push('/workspace')
}

const openCreate = () => {
  showDropdown.value = false
  showCreateModal.value = true
}

// Group workspaces by organization
const groupedWorkspaces = computed(() => {
  const groups: { orgId: string; orgName: string; workspaces: typeof workspaces.value }[] = []
  const map = new Map<string, typeof groups[0]>()

  for (const ws of workspaces.value) {
    let group = map.get(ws.organizationId)
    if (!group) {
      group = { orgId: ws.organizationId, orgName: ws.organizationName, workspaces: [] }
      map.set(ws.organizationId, group)
      groups.push(group)
    }
    group.workspaces.push(ws)
  }

  return groups
})

// Close on outside click
const dropdownRef = ref<HTMLElement | null>(null)
onMounted(() => {
  const handler = (e: MouseEvent) => {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
      showDropdown.value = false
    }
  }
  document.addEventListener('click', handler)
  onUnmounted(() => document.removeEventListener('click', handler))
})

onMounted(() => {
  if (workspaces.value.length === 0) {
    fetchWorkspaces()
  }
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      @click="toggle"
      class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
    >
      <div class="w-7 h-7 bg-slate-900 dark:bg-white/[0.1] rounded-lg flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="flex-1 min-w-0 text-left">
        <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
          {{ currentWorkspace?.name ?? 'Select workspace' }}
        </div>
      </div>
      <Icon name="heroicons:chevron-up-down" class="w-4 h-4 text-slate-400 flex-shrink-0" />
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showDropdown"
        class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.08] py-1 z-50 max-h-72 overflow-y-auto"
      >
        <template v-for="(group, gi) in groupedWorkspaces" :key="group.orgId">
          <!-- Org divider between groups -->
          <div v-if="gi > 0" class="border-t border-slate-100 dark:border-white/[0.06] my-1" />

          <!-- Org header -->
          <div class="px-3 pt-2 pb-1 flex items-center gap-1.5">
            <Icon name="heroicons:building-office-2" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{{ group.orgName }}</span>
          </div>

          <!-- Workspaces nested under org -->
          <button
            v-for="ws in group.workspaces"
            :key="ws.id"
            @click="selectWorkspace(ws.id)"
            class="w-full flex items-center gap-2.5 pl-5 pr-3 py-1.5 text-sm transition-colors"
            :class="ws.id === currentWorkspaceId
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-700 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-5 h-5 rounded bg-slate-200 dark:bg-white/[0.1] flex items-center justify-center flex-shrink-0">
              <span class="text-[10px] font-semibold text-slate-600 dark:text-zinc-300">{{ ws.name.charAt(0).toUpperCase() }}</span>
            </div>
            <span class="flex-1 text-left truncate">{{ ws.name }}</span>
            <span class="text-xs text-slate-400">{{ ws.memberCount }}</span>
            <Icon v-if="ws.id === currentWorkspaceId" name="heroicons:check" class="w-4 h-4 text-blue-500 flex-shrink-0" />
          </button>
        </template>

        <div v-if="isOrgAdmin" class="border-t border-slate-100 dark:border-white/[0.06] mt-1 pt-1">
          <button
            @click="openCreate"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Icon name="heroicons:plus" class="w-5 h-5 text-slate-400" />
            <span>Create workspace</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Create workspace modal -->
    <WorkspaceCreateWorkspaceModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
    />
  </div>
</template>
