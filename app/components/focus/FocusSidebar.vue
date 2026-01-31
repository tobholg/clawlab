<script setup lang="ts">
import type { FocusLane } from '~/composables/useFocus'

const props = defineProps<{
  workspaceId: string | null
}>()

const {
  focusState,
  hasProjectFocus,
  hasTaskFocus,
  activityLabel,
  startProjectFocus,
  clearProjectFocus,
  switchToLane,
  completeTask,
  loadFocusState,
  LANE_LABELS,
  LANE_ICONS,
} = useFocus()

// Modal states
const showProjectPicker = ref(false)
const showLanePicker = ref(false)
const showTaskActionModal = ref(false)
const showTimeline = ref(false)
const actionComment = ref('')
const selectedNextLane = ref<FocusLane>('GENERAL')

// Available projects
const projects = ref<{ id: string; title: string }[]>([])

// Load focus state on mount
onMounted(async () => {
  await loadFocusState()
})

// Load projects when workspaceId is available
watch(() => props.workspaceId, async (wsId) => {
  if (wsId) {
    try {
      const data = await $fetch('/api/items', {
        query: { workspaceId: wsId, parentId: 'root' }
      })
      if (data && Array.isArray(data)) {
        projects.value = data.map((p: any) => ({ id: p.id, title: p.title }))
      }
    } catch (e) {
      console.error('Failed to load projects:', e)
    }
  }
}, { immediate: true })

// Duration display
const durationDisplay = ref('')
let durationInterval: ReturnType<typeof setInterval> | null = null

watch(() => focusState.value.activityStart, (start) => {
  if (durationInterval) clearInterval(durationInterval)
  if (start) {
    const updateDuration = () => {
      const now = new Date()
      const diffMs = now.getTime() - new Date(start).getTime()
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
  } else {
    durationDisplay.value = ''
  }
}, { immediate: true })

onUnmounted(() => {
  if (durationInterval) clearInterval(durationInterval)
})

// Actions
const selectProject = async (projectId: string) => {
  await startProjectFocus(projectId)
  showProjectPicker.value = false
}

const selectLane = async (lane: FocusLane) => {
  await switchToLane(lane)
  showLanePicker.value = false
}

const handleTaskAction = () => {
  actionComment.value = ''
  selectedNextLane.value = 'GENERAL'
  showTaskActionModal.value = true
}

const handleSwitch = async () => {
  await completeTask(actionComment.value || undefined, false)
  showTaskActionModal.value = false
  await switchToLane(selectedNextLane.value)
}

const handleComplete = async () => {
  await completeTask(actionComment.value || undefined, true)
  showTaskActionModal.value = false
  await switchToLane(selectedNextLane.value)
}

const lanes: FocusLane[] = ['GENERAL', 'MEETING', 'ADMIN', 'LEARNING', 'BREAK']
</script>

<template>
  <div class="px-3 mb-4">
    <!-- Section Title -->
    <button
      @click="showTimeline = true"
      class="mb-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider px-0 hover:text-slate-700 transition-colors flex items-center gap-1"
    >
      Focus
      <Icon name="heroicons:clock" class="w-3 h-3" />
    </button>

    <div class="space-y-1">
      <!-- Project Focus -->
      <button
        @click="showProjectPicker = true"
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200"
        :class="hasProjectFocus
          ? 'bg-blue-50 text-blue-900'
          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
      >
        <div 
          class="w-4 h-4 flex items-center justify-center flex-shrink-0"
          :class="hasProjectFocus ? 'text-blue-500' : 'text-slate-400'"
        >
          <Icon name="heroicons:folder" class="w-4 h-4" />
        </div>
        <span class="flex-1 text-left truncate">
          {{ focusState.project?.title || 'No project' }}
        </span>
        <Icon name="heroicons:chevron-right" class="w-3 h-3 flex-shrink-0" :class="hasProjectFocus ? 'text-blue-400' : 'text-slate-400'" />
      </button>

      <!-- Task/Lane Focus -->
      <button
        v-if="hasProjectFocus"
        @click="hasTaskFocus ? handleTaskAction() : showLanePicker = true"
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200"
        :class="hasTaskFocus
          ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
      >
        <div 
          class="w-4 h-4 flex items-center justify-center flex-shrink-0"
          :class="hasTaskFocus ? 'text-emerald-500' : 'text-slate-400'"
        >
          <Icon 
            :name="hasTaskFocus ? 'heroicons:bolt' : LANE_ICONS[focusState.lane?.type || 'GENERAL']" 
            class="w-4 h-4"
          />
        </div>
        <span class="flex-1 text-left truncate">
          {{ activityLabel }}
        </span>
        <span class="text-[10px] flex-shrink-0" :class="hasTaskFocus ? 'text-emerald-500' : 'text-slate-400'">
          {{ durationDisplay }}
        </span>
        <Icon 
          name="heroicons:chevron-right" 
          class="w-3 h-3 flex-shrink-0" 
          :class="hasTaskFocus ? 'text-emerald-400' : 'text-slate-400'" 
        />
      </button>

      <!-- No Focus State -->
      <div 
        v-if="!hasProjectFocus"
        class="px-3 py-2 text-[10px] text-slate-400 italic"
      >
        Select a project to start
      </div>
    </div>

    <!-- Project Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showProjectPicker"
        class="fixed inset-0 z-50 flex items-start justify-center pt-16"
        @click.self="showProjectPicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showProjectPicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-80 max-h-96 overflow-hidden">
          <div class="p-4 border-b border-slate-100">
            <h3 class="text-sm font-medium text-slate-900">Select Project</h3>
          </div>
          <div class="p-2 max-h-72 overflow-y-auto">
            <button
              v-if="hasProjectFocus"
              @click="clearProjectFocus(); showProjectPicker = false"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left text-slate-400 text-sm"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4" />
              Clear focus
            </button>
            <div v-if="hasProjectFocus" class="my-1 border-t border-slate-100"></div>
            <button
              v-for="project in projects"
              :key="project.id"
              @click="selectProject(project.id)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left text-sm"
              :class="focusState.project?.id === project.id && 'bg-blue-50 text-blue-900'"
            >
              <div class="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span class="text-[10px] text-blue-600 font-medium">{{ project.title.charAt(0) }}</span>
              </div>
              <span class="truncate">{{ project.title }}</span>
              <Icon 
                v-if="focusState.project?.id === project.id"
                name="heroicons:check" 
                class="w-4 h-4 text-blue-500 ml-auto" 
              />
            </button>
            <div v-if="!projects.length" class="px-3 py-6 text-sm text-slate-400 text-center">
              No projects
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Lane Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showLanePicker"
        class="fixed inset-0 z-50 flex items-start justify-center pt-16"
        @click.self="showLanePicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showLanePicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-64 overflow-hidden">
          <div class="p-4 border-b border-slate-100">
            <h3 class="text-sm font-medium text-slate-900">Activity</h3>
          </div>
          <div class="p-2">
            <button
              v-for="lane in lanes"
              :key="lane"
              @click="selectLane(lane)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
              :class="focusState.lane?.type === lane && 'bg-slate-100'"
            >
              <Icon :name="LANE_ICONS[lane]" class="w-4 h-4 text-slate-400" />
              <span>{{ LANE_LABELS[lane] }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Task Action Modal -->
    <Teleport to="body">
      <div
        v-if="showTaskActionModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="showTaskActionModal = false"
      >
        <div class="absolute inset-0 bg-black/25" @click="showTaskActionModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <!-- Header -->
          <div class="px-5 pt-5 pb-4">
            <p class="text-base font-medium text-slate-900 leading-snug">
              {{ focusState.task?.title }}
            </p>
            <p class="text-xs text-slate-400 mt-1">{{ durationDisplay }}</p>
          </div>

          <!-- Note -->
          <div class="px-5 pb-4">
            <input
              v-model="actionComment"
              type="text"
              placeholder="Add a note..."
              class="w-full px-0 py-2 text-sm border-0 border-b border-slate-200 focus:outline-none focus:border-slate-400 bg-transparent placeholder:text-slate-300"
            />
          </div>

          <!-- Next Lane Selection -->
          <div class="px-5 pb-4">
            <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Next</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="lane in lanes"
                :key="lane"
                @click="selectedNextLane = lane"
                class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full transition-colors"
                :class="selectedNextLane === lane 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              >
                <Icon :name="LANE_ICONS[lane]" class="w-3.5 h-3.5" />
                {{ LANE_LABELS[lane] }}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex border-t border-slate-100">
            <button
              @click="handleSwitch"
              class="flex-1 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Switch
            </button>
            <div class="w-px bg-slate-100"></div>
            <button
              @click="handleComplete"
              class="flex-1 px-4 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Complete ✓
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Timeline Modal -->
    <Teleport to="body">
      <div
        v-if="showTimeline"
        class="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8"
        @click.self="showTimeline = false"
      >
        <div class="absolute inset-0 bg-black/25" @click="showTimeline = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 class="text-base font-medium text-slate-900">Focus Timeline</h2>
            <button 
              @click="showTimeline = false"
              class="p-1 text-slate-400 hover:text-slate-600"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Timeline content -->
          <div class="flex-1 overflow-y-auto p-4">
            <FocusTimeline />
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-slate-100 flex-shrink-0">
            <NuxtLink 
              to="/workspace/focus"
              @click="showTimeline = false"
              class="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
            >
              View all
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
