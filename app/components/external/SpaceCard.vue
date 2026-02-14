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

interface SpaceUpdate {
  id: string
  title: string
  summary: string
  wins: Array<{ text: string }>
  risks: Array<{ text: string }>
  status: 'DRAFT' | 'PUBLISHED' | 'DISCARDED'
  publishedAt: string | null
  createdAt: string
  generatedBy: { name: string }
}

const props = defineProps<{
  space: Space
  generatingUpdate?: boolean
}>()

const emit = defineEmits<{
  settings: [space: Space]
  stakeholders: [space: Space]
  invite: [space: Space]
  generateUpdate: [space: Space]
  editUpdate: [update: SpaceUpdate, space: Space]
}>()

const showUpdates = ref(false)
const updates = ref<SpaceUpdate[]>([])
const loadingUpdates = ref(false)
const deletingUpdateId = ref<string | null>(null)
const confirmDeleteId = ref<string | null>(null)

const fetchUpdates = async () => {
  loadingUpdates.value = true
  try {
    const result = await $fetch<SpaceUpdate[]>(`/api/s/${props.space.id}/${props.space.slug}/updates`)
    updates.value = result
  } catch {
    updates.value = []
  } finally {
    loadingUpdates.value = false
  }
}

const toggleUpdates = () => {
  showUpdates.value = !showUpdates.value
  if (showUpdates.value && updates.value.length === 0) {
    fetchUpdates()
  }
}

const handleDeleteUpdate = async (updateId: string) => {
  deletingUpdateId.value = updateId
  try {
    await $fetch(`/api/s/${props.space.id}/${props.space.slug}/updates/${updateId}`, {
      method: 'DELETE',
    })
    updates.value = updates.value.filter(u => u.id !== updateId)
  } catch (e: any) {
    alert('Failed to delete update: ' + (e.data?.message || e.message))
  } finally {
    deletingUpdateId.value = null
    confirmDeleteId.value = null
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

defineExpose({ refreshUpdates: fetchUpdates })
</script>

<template>
  <div class="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors">
    <!-- Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-500/10 dark:to-violet-500/20 flex items-center justify-center">
          <Icon name="heroicons:globe-alt" class="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <h3 class="font-medium text-slate-900 dark:text-zinc-100 text-sm">{{ space.name }}</h3>
          <p class="text-xs text-slate-400 dark:text-zinc-500">/{{ space.slug }}</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <NuxtLink
          :to="`/s/${space.id}/${space.slug}`"
          target="_blank"
          class="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
          title="Visit portal"
        >
          <Icon name="heroicons:arrow-top-right-on-square" class="w-4 h-4" />
        </NuxtLink>
        <button
          @click="emit('generateUpdate', space)"
          :disabled="props.generatingUpdate"
          class="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Generate stakeholder update"
        >
          <Icon v-if="props.generatingUpdate" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          <Icon v-else name="heroicons:megaphone" class="w-4 h-4" />
        </button>
        <button
          @click="emit('invite', space)"
          class="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-500/10 transition-colors"
          title="Copy invite link"
        >
          <Icon name="heroicons:link" class="w-4 h-4" />
        </button>
        <button
          @click="emit('settings', space)"
          class="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] transition-colors"
          title="Space settings"
        >
          <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Description -->
    <p v-if="space.description" class="text-xs text-slate-500 dark:text-zinc-400 mb-3 line-clamp-2">
      {{ space.description }}
    </p>

    <!-- Stats -->
    <div class="flex items-center gap-4 text-xs">
      <button
        @click="emit('stakeholders', space)"
        class="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
      >
        <Icon name="heroicons:users" class="w-3.5 h-3.5" />
        <span>{{ space.stakeholderCount }} {{ space.stakeholderCount === 1 ? 'member' : 'members' }}</span>
      </button>

      <div class="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500">
        <Icon name="heroicons:envelope" class="w-3.5 h-3.5" />
        <span>{{ space.maxIRsPer24h }}/day</span>
      </div>

      <div v-if="space.allowTaskSubmission" class="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
        <Icon name="heroicons:check-circle" class="w-3.5 h-3.5" />
        <span>Tasks enabled</span>
      </div>

      <button
        @click="toggleUpdates"
        class="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors ml-auto"
      >
        <Icon name="heroicons:megaphone" class="w-3.5 h-3.5" />
        <span>Updates</span>
        <Icon
          name="heroicons:chevron-down"
          class="w-3 h-3 transition-transform"
          :class="{ 'rotate-180': showUpdates }"
        />
      </button>
    </div>

    <!-- Updates List -->
    <div v-if="showUpdates" class="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
      <div v-if="loadingUpdates" class="flex items-center justify-center py-4">
        <div class="w-4 h-4 border-2 border-slate-200 border-t-slate-600 dark:border-white/[0.06] dark:border-t-zinc-300 rounded-full animate-spin" />
      </div>

      <div v-else-if="updates.length === 0" class="text-center py-4">
        <p class="text-xs text-slate-400 dark:text-zinc-500">No updates yet</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="update in updates"
          :key="update.id"
          class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] group"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">{{ update.title }}</span>
              <span
                :class="[
                  'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
                  update.status === 'PUBLISHED'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                ]"
              >
                {{ update.status === 'PUBLISHED' ? 'Published' : 'Draft' }}
              </span>
            </div>
            <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
              {{ formatDate(update.publishedAt || update.createdAt) }} · {{ update.generatedBy.name }}
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="emit('editUpdate', update, space)"
              class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors"
              title="Edit update"
            >
              <Icon name="heroicons:pencil-square" class="w-3.5 h-3.5" />
            </button>

            <button
              v-if="confirmDeleteId !== update.id"
              @click="confirmDeleteId = update.id"
              class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
              title="Delete update"
            >
              <Icon name="heroicons:trash" class="w-3.5 h-3.5" />
            </button>

            <template v-else>
              <button
                @click="handleDeleteUpdate(update.id)"
                :disabled="deletingUpdateId === update.id"
                class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {{ deletingUpdateId === update.id ? '...' : 'Delete' }}
              </button>
              <button
                @click="confirmDeleteId = null"
                class="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Icon name="heroicons:x-mark" class="w-3 h-3" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
