<script setup lang="ts">
import type { FocusLane } from '~/composables/useFocus'

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
const showCompletionModal = ref(false)
const completionComment = ref('')

// Available projects
const projects = ref<{ id: string; title: string }[]>([])

// Load on mount
onMounted(async () => {
  await loadFocusState()
  try {
    const data = await $fetch('/api/items', {
      query: { workspaceId: 'default', parentId: 'root' }
    })
    if (data && Array.isArray(data)) {
      projects.value = data.map((p: any) => ({ id: p.id, title: p.title }))
    }
  } catch (e) {
    console.error('Failed to load projects:', e)
  }
})

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

const handleCompleteTask = () => {
  showCompletionModal.value = true
}

const submitCompletion = async (startNext?: { type: 'task' | 'lane'; id?: string; lane?: FocusLane }) => {
  await completeTask(completionComment.value || undefined)
  completionComment.value = ''
  showCompletionModal.value = false
  
  if (startNext?.type === 'lane' && startNext.lane) {
    await switchToLane(startNext.lane)
  }
}

const lanes: FocusLane[] = ['GENERAL', 'MEETING', 'ADMIN', 'LEARNING', 'BREAK']
</script>

<template>
  <div class="px-3 mb-4">
    <!-- Section Title -->
    <h3 class="mb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider px-0">
      Focus
    </h3>

    <div class="space-y-1">
      <!-- Project Focus -->
      <button
        @click="showProjectPicker = true"
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200"
        :class="hasProjectFocus 
          ? 'bg-slate-100 text-slate-900' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'"
      >
        <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <Icon name="heroicons:folder" class="w-4 h-4" />
        </div>
        <span class="flex-1 text-left truncate">
          {{ focusState.project?.title || 'No project' }}
        </span>
        <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 flex-shrink-0" />
      </button>

      <!-- Task/Lane Focus -->
      <div 
        v-if="hasProjectFocus"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
        :class="hasTaskFocus 
          ? 'bg-amber-50 text-amber-900' 
          : 'text-slate-500'"
      >
        <!-- Activity Icon -->
        <div 
          class="w-4 h-4 flex items-center justify-center flex-shrink-0"
          :class="hasTaskFocus ? 'text-amber-500' : 'text-slate-400'"
        >
          <Icon 
            :name="hasTaskFocus ? 'heroicons:bolt' : LANE_ICONS[focusState.lane?.type || 'GENERAL']" 
            class="w-4 h-4"
          />
        </div>

        <!-- Activity Label -->
        <button
          @click="hasTaskFocus ? null : showLanePicker = true"
          class="flex-1 text-left truncate"
          :class="!hasTaskFocus && 'hover:text-slate-700 cursor-pointer'"
        >
          {{ activityLabel }}
        </button>

        <!-- Duration -->
        <span class="text-[10px] text-slate-400 flex-shrink-0">{{ durationDisplay }}</span>

        <!-- Complete (for tasks) -->
        <button
          v-if="hasTaskFocus"
          @click="handleCompleteTask"
          class="w-4 h-4 flex items-center justify-center text-emerald-500 hover:text-emerald-600 flex-shrink-0"
          title="Complete task"
        >
          <Icon name="heroicons:check" class="w-4 h-4" />
        </button>

        <!-- Lane picker (for lanes) -->
        <button
          v-else
          @click="showLanePicker = true"
          class="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 flex-shrink-0"
        >
          <Icon name="heroicons:chevron-down" class="w-3 h-3" />
        </button>
      </div>

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
        class="fixed inset-0 z-50 flex items-start justify-center pt-20"
        @click.self="showProjectPicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showProjectPicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-72 max-h-80 overflow-hidden">
          <div class="p-3 border-b border-slate-100">
            <h3 class="text-sm font-medium text-slate-900">Select Project</h3>
          </div>
          <div class="p-2 max-h-64 overflow-y-auto">
            <!-- Clear option -->
            <button
              v-if="hasProjectFocus"
              @click="clearProjectFocus(); showProjectPicker = false"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left text-slate-500"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4" />
              <span class="text-xs">Clear focus</span>
            </button>
            <div v-if="hasProjectFocus" class="my-1 border-t border-slate-100"></div>
            <!-- Projects -->
            <button
              v-for="project in projects"
              :key="project.id"
              @click="selectProject(project.id)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left"
              :class="focusState.project?.id === project.id && 'bg-slate-100'"
            >
              <div class="w-5 h-5 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                <span class="text-[10px] text-slate-600 font-medium">{{ project.title.charAt(0) }}</span>
              </div>
              <span class="text-xs text-slate-900 truncate">{{ project.title }}</span>
              <Icon 
                v-if="focusState.project?.id === project.id"
                name="heroicons:check" 
                class="w-4 h-4 text-slate-600 ml-auto flex-shrink-0" 
              />
            </button>
            <div v-if="!projects.length" class="px-3 py-4 text-xs text-slate-400 text-center">
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
        <div class="relative bg-white rounded-xl shadow-xl w-56 overflow-hidden">
          <div class="p-3 border-b border-slate-100">
            <h3 class="text-sm font-medium text-slate-900">Switch Activity</h3>
          </div>
          <div class="p-2">
            <button
              v-for="lane in lanes"
              :key="lane"
              @click="selectLane(lane)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
              :class="focusState.lane?.type === lane && 'bg-slate-100'"
            >
              <div class="w-4 h-4 flex items-center justify-center">
                <Icon :name="LANE_ICONS[lane]" class="w-4 h-4 text-slate-500" />
              </div>
              <span class="text-xs text-slate-900">{{ LANE_LABELS[lane] }}</span>
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
        <div class="relative bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
          <!-- Header -->
          <div class="p-4 text-center bg-gradient-to-br from-emerald-50 to-teal-50">
            <div class="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-100 flex items-center justify-center">
              <Icon name="heroicons:check-circle" class="w-6 h-6 text-emerald-600" />
            </div>
            <h3 class="text-sm font-semibold text-slate-900">Well done! 🎉</h3>
            <p class="text-xs text-slate-600 mt-0.5 truncate px-4">
              {{ focusState.task?.title }}
            </p>
            <p class="text-[10px] text-slate-400 mt-0.5">{{ durationDisplay }}</p>
          </div>

          <!-- Comment -->
          <div class="p-3">
            <label class="block text-xs font-medium text-slate-700 mb-1.5">
              Quick note <span class="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              v-model="completionComment"
              placeholder="What did you accomplish?"
              rows="2"
              class="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            ></textarea>
          </div>

          <!-- What's next -->
          <div class="px-3 pb-3">
            <label class="block text-xs font-medium text-slate-700 mb-1.5">What's next?</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="lane in lanes.filter(l => l !== 'GENERAL')"
                :key="lane"
                @click="submitCompletion({ type: 'lane', lane })"
                class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <Icon :name="LANE_ICONS[lane]" class="w-3 h-3" />
                {{ LANE_LABELS[lane] }}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-3 border-t border-slate-100 flex gap-2">
            <button
              @click="showCompletionModal = false"
              class="flex-1 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              @click="submitCompletion()"
              class="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
