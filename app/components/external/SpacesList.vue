<script setup lang="ts">
interface Space {
  id: string
  name: string
  slug: string
  description?: string | null
  maxIRsPer24h: number
  allowTaskSubmission: boolean
  stakeholderCount: number
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  spaceCreated: [space: Space]
  spaceUpdated: [space: Space]
  spaceDeleted: [spaceId: string]
}>()

const spaces = ref<Space[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const showCreateModal = ref(false)
const showSettingsModal = ref(false)
const showStakeholdersModal = ref(false)
const selectedSpace = ref<Space | null>(null)

const fetchSpaces = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<{ spaces: Space[] }>(`/api/projects/${props.projectId}/spaces`)
    spaces.value = response.spaces
  } catch (e: any) {
    error.value = e.message || 'Failed to load spaces'
  } finally {
    loading.value = false
  }
}

const handleSettings = (space: Space) => {
  selectedSpace.value = space
  showSettingsModal.value = true
}

const handleStakeholders = (space: Space) => {
  selectedSpace.value = space
  showStakeholdersModal.value = true
}

const handleInvite = async (space: Space) => {
  try {
    const response = await $fetch<{ inviteUrl: string }>(`/api/projects/${props.projectId}/spaces/${space.id}/invite`, {
      method: 'POST'
    })
    await navigator.clipboard.writeText(response.inviteUrl)
    // Show toast notification (you might have a notification system)
    alert('Invite link copied to clipboard!')
  } catch (e: any) {
    alert('Failed to generate invite link: ' + e.message)
  }
}

const handleSpaceCreated = (space: Space) => {
  spaces.value.unshift(space)
  showCreateModal.value = false
  emit('spaceCreated', space)
}

const handleSpaceUpdated = (space: Space) => {
  const index = spaces.value.findIndex(s => s.id === space.id)
  if (index !== -1) {
    spaces.value[index] = space
  }
  showSettingsModal.value = false
  emit('spaceUpdated', space)
}

const handleSpaceDeleted = (spaceId: string) => {
  spaces.value = spaces.value.filter(s => s.id !== spaceId)
  showSettingsModal.value = false
  emit('spaceDeleted', spaceId)
}

onMounted(fetchSpaces)

// Expose refresh method
defineExpose({ refresh: fetchSpaces })
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-medium text-slate-900 dark:text-zinc-100">External Spaces</h2>
        <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Create portals for clients, investors, and partners</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-normal rounded-lg hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
      >
        <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
        <span>New Space</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-600 dark:border-white/[0.06] dark:border-t-zinc-300 rounded-full animate-spin" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <Icon name="heroicons:exclamation-circle" class="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p class="text-sm text-slate-600 dark:text-zinc-400">{{ error }}</p>
      <button @click="fetchSpaces" class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2">
        Try again
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="spaces.length === 0" class="text-center py-12 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06]">
      <Icon name="heroicons:globe-alt" class="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
      <h3 class="text-sm font-medium text-slate-600 dark:text-zinc-300 mb-1">No external spaces yet</h3>
      <p class="text-xs text-slate-400 dark:text-zinc-500 mb-4 max-w-xs mx-auto">
        Create spaces to give clients, investors, or partners a window into your project
      </p>
      <button
        @click="showCreateModal = true"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-normal rounded-lg hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
      >
        <Icon name="heroicons:plus" class="w-4 h-4" />
        Create your first space
      </button>
    </div>

    <!-- Spaces Grid -->
    <div v-else class="grid gap-3 sm:grid-cols-2">
      <ExternalSpaceCard
        v-for="space in spaces"
        :key="space.id"
        :space="space"
        @settings="handleSettings"
        @stakeholders="handleStakeholders"
        @invite="handleInvite"
      />
    </div>

    <!-- Create Modal -->
    <ExternalSpaceSettingsModal
      :open="showCreateModal"
      :project-id="projectId"
      @close="showCreateModal = false"
      @saved="handleSpaceCreated"
    />

    <!-- Settings Modal -->
    <ExternalSpaceSettingsModal
      v-if="selectedSpace"
      :open="showSettingsModal"
      :project-id="projectId"
      :space="selectedSpace"
      @close="showSettingsModal = false"
      @saved="handleSpaceUpdated"
      @deleted="handleSpaceDeleted"
    />

    <!-- Stakeholders Modal -->
    <ExternalSpaceStakeholdersModal
      v-if="selectedSpace"
      :open="showStakeholdersModal"
      :project-id="projectId"
      :space="selectedSpace"
      @close="showStakeholdersModal = false"
    />
  </div>
</template>
