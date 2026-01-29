<script setup lang="ts">
import type { FocusLane } from '~/composables/useFocus'

const {
  focusState,
  hasProjectFocus,
  hasTaskFocus,
  activityLabel,
  activityDuration,
  projectDuration,
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
const showCompletionModal = ref(false)
const completionComment = ref('')

// Available projects (will come from API)
const projects = ref<{ id: string; title: string }[]>([])

// Load on mount
onMounted(async () => {
  await loadFocusState()
  // TODO: Load projects from API
  const { data } = await useFetch('/api/items?rootOnly=true')
  if (data.value) {
    projects.value = (data.value as any[]).map(p => ({ id: p.id, title: p.title }))
  }
})

// Update duration every minute
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

const handleCompleteTask = async () => {
  showCompletionModal.value = true
}

const submitCompletion = async (startNext?: { type: 'task' | 'lane'; id?: string; lane?: FocusLane }) => {
  await completeTask(completionComment.value || undefined)
  completionComment.value = ''
  showCompletionModal.value = false
  
  if (startNext?.type === 'lane' && startNext.lane) {
    await switchToLane(startNext.lane)
  }
  // TODO: Handle starting next task
}

const lanes: FocusLane[] = ['GENERAL', 'MEETING', 'ADMIN', 'LEARNING', 'BREAK']
</script>

<template>
  <div class="px-4 py-3 border-b border-gray-200">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Focus</span>
      <button
        v-if="hasProjectFocus"
        @click="clearProjectFocus"
        class="text-gray-400 hover:text-gray-600 p-0.5"
        title="End all focus"
      >
        <Icon name="heroicons:x-mark" class="w-4 h-4" />
      </button>
    </div>

    <!-- Focus Card -->
    <div 
      class="rounded-lg border transition-all"
      :class="hasProjectFocus 
        ? 'bg-gradient-to-br from-relai-50 to-indigo-50 border-relai-200' 
        : 'bg-gray-50 border-gray-200 border-dashed'"
    >
      <!-- No Focus State -->
      <button
        v-if="!hasProjectFocus"
        @click="showProjectPicker = true"
        class="w-full p-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div class="flex items-center gap-2 text-gray-500">
          <Icon name="heroicons:cursor-arrow-rays" class="w-5 h-5" />
          <span class="text-sm">Start focus...</span>
        </div>
      </button>

      <!-- Active Focus State -->
      <div v-else class="p-3 space-y-2">
        <!-- Project Row -->
        <button
          @click="showProjectPicker = true"
          class="w-full flex items-center gap-2 text-left group"
        >
          <div class="w-6 h-6 rounded bg-relai-500 flex items-center justify-center flex-shrink-0">
            <span class="text-xs text-white font-semibold">
              {{ focusState.project?.title?.charAt(0) || '?' }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate group-hover:text-relai-600">
              {{ focusState.project?.title }}
            </div>
          </div>
          <Icon name="heroicons:chevron-down" class="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>

        <!-- Divider -->
        <div class="border-t border-relai-200/50"></div>

        <!-- Activity Row -->
        <div class="flex items-center gap-2">
          <!-- Activity indicator -->
          <div 
            class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            :class="hasTaskFocus ? 'bg-amber-100' : 'bg-gray-100'"
          >
            <Icon 
              :name="hasTaskFocus ? 'heroicons:bolt' : LANE_ICONS[focusState.lane?.type || 'GENERAL']" 
              class="w-3.5 h-3.5"
              :class="hasTaskFocus ? 'text-amber-600' : 'text-gray-500'"
            />
          </div>

          <!-- Activity label -->
          <button
            @click="hasTaskFocus ? null : showLanePicker = true"
            class="flex-1 min-w-0 text-left"
            :class="!hasTaskFocus && 'hover:opacity-80'"
          >
            <div 
              class="text-sm truncate"
              :class="hasTaskFocus ? 'font-medium text-gray-900' : 'text-gray-600'"
            >
              {{ activityLabel }}
            </div>
          </button>

          <!-- Duration -->
          <span class="text-xs text-gray-400 flex-shrink-0">{{ durationDisplay }}</span>

          <!-- Complete button (for tasks) -->
          <button
            v-if="hasTaskFocus"
            @click="handleCompleteTask"
            class="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
            title="Complete task"
          >
            <Icon name="heroicons:check" class="w-4 h-4" />
          </button>

          <!-- Lane picker button (for lanes) -->
          <button
            v-else
            @click="showLanePicker = true"
            class="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
            title="Switch lane"
          >
            <Icon name="heroicons:chevron-down" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Project Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showProjectPicker"
        class="fixed inset-0 z-50 flex items-start justify-center pt-20"
        @click.self="showProjectPicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showProjectPicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-80 max-h-96 overflow-hidden">
          <div class="p-3 border-b border-gray-100">
            <h3 class="font-medium text-gray-900">Select Project</h3>
          </div>
          <div class="p-2 max-h-72 overflow-y-auto">
            <button
              v-for="project in projects"
              :key="project.id"
              @click="selectProject(project.id)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left"
              :class="focusState.project?.id === project.id && 'bg-relai-50'"
            >
              <div class="w-8 h-8 rounded-lg bg-relai-100 flex items-center justify-center">
                <span class="text-relai-600 font-medium">{{ project.title.charAt(0) }}</span>
              </div>
              <span class="text-sm text-gray-900">{{ project.title }}</span>
              <Icon 
                v-if="focusState.project?.id === project.id"
                name="heroicons:check" 
                class="w-4 h-4 text-relai-600 ml-auto" 
              />
            </button>
            <div v-if="!projects.length" class="px-3 py-4 text-sm text-gray-500 text-center">
              No projects found
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Lane Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showLanePicker"
        class="fixed inset-0 z-50 flex items-start justify-center pt-20"
        @click.self="showLanePicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showLanePicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-64 overflow-hidden">
          <div class="p-3 border-b border-gray-100">
            <h3 class="font-medium text-gray-900">Switch Activity</h3>
          </div>
          <div class="p-2">
            <button
              v-for="lane in lanes"
              :key="lane"
              @click="selectLane(lane)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50"
              :class="focusState.lane?.type === lane && 'bg-gray-100'"
            >
              <Icon :name="LANE_ICONS[lane]" class="w-5 h-5 text-gray-500" />
              <span class="text-sm text-gray-900">{{ LANE_LABELS[lane] }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Task Completion Modal -->
    <Teleport to="body">
      <div
        v-if="showCompletionModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="showCompletionModal = false"
      >
        <div class="absolute inset-0 bg-black/30" @click="showCompletionModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
          <!-- Header -->
          <div class="p-5 text-center bg-gradient-to-br from-emerald-50 to-teal-50">
            <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
              <Icon name="heroicons:check-circle" class="w-7 h-7 text-emerald-600" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Well done! 🎉</h3>
            <p class="text-sm text-gray-600 mt-1">
              {{ focusState.task?.title }}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">{{ durationDisplay }}</p>
          </div>

          <!-- Comment -->
          <div class="p-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Quick note <span class="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              v-model="completionComment"
              placeholder="What did you accomplish? Any blockers?"
              rows="2"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-relai-500 resize-none"
            ></textarea>
          </div>

          <!-- What's next -->
          <div class="px-4 pb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">What's next?</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="lane in lanes.filter(l => l !== 'GENERAL')"
                :key="lane"
                @click="submitCompletion({ type: 'lane', lane })"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                <Icon :name="LANE_ICONS[lane]" class="w-3.5 h-3.5" />
                {{ LANE_LABELS[lane] }}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-4 border-t border-gray-100 flex gap-2">
            <button
              @click="showCompletionModal = false"
              class="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              @click="submitCompletion()"
              class="flex-1 px-4 py-2 text-sm font-medium text-white bg-relai-600 hover:bg-relai-700 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
