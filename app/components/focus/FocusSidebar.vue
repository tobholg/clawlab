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
const actionComment = ref('')

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

// Open task action modal
const handleTaskAction = () => {
  actionComment.value = ''
  showTaskActionModal.value = true
}

// Complete task (mark as done)
const handleComplete = async (nextLane?: FocusLane) => {
  await completeTask(actionComment.value || undefined, true)
  actionComment.value = ''
  showTaskActionModal.value = false
  if (nextLane) {
    await switchToLane(nextLane)
  }
}

// Switch away from task (don't mark as done)
const handleSwitch = async (nextLane: FocusLane) => {
  await completeTask(actionComment.value || undefined, false)
  actionComment.value = ''
  showTaskActionModal.value = false
  await switchToLane(nextLane)
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
          ? 'bg-blue-50 text-blue-900' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'"
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
        <Icon name="heroicons:chevron-down" class="w-3 h-3 flex-shrink-0" :class="hasProjectFocus ? 'text-blue-400' : 'text-slate-400'" />
      </button>

      <!-- Task/Lane Focus -->
      <div 
        v-if="hasProjectFocus"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
        :class="hasTaskFocus 
          ? 'bg-emerald-50 text-emerald-900' 
          : 'text-slate-500'"
      >
        <!-- Activity Icon -->
        <div 
          class="w-4 h-4 flex items-center justify-center flex-shrink-0"
          :class="hasTaskFocus ? 'text-emerald-500' : 'text-slate-400'"
        >
          <Icon 
            :name="hasTaskFocus ? 'heroicons:bolt' : LANE_ICONS[focusState.lane?.type || 'GENERAL']" 
            class="w-4 h-4"
          />
        </div>

        <!-- Activity Label -->
        <button
          @click="hasTaskFocus ? handleTaskAction() : showLanePicker = true"
          class="flex-1 text-left truncate hover:opacity-80"
        >
          {{ activityLabel }}
        </button>

        <!-- Duration -->
        <span class="text-[10px] flex-shrink-0" :class="hasTaskFocus ? 'text-emerald-500' : 'text-slate-400'">
          {{ durationDisplay }}
        </span>

        <!-- Single action button -->
        <button
          v-if="hasTaskFocus"
          @click="handleTaskAction"
          class="w-4 h-4 flex items-center justify-center text-emerald-500 hover:text-emerald-600 flex-shrink-0"
          title="Task actions"
        >
          <Icon name="heroicons:ellipsis-vertical" class="w-4 h-4" />
        </button>
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
        class="fixed inset-0 z-50 flex items-start justify-center pt-16"
        @click.self="showProjectPicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showProjectPicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-96 max-h-[28rem] overflow-hidden">
          <div class="p-4 border-b border-slate-100">
            <h3 class="text-sm font-medium text-slate-900">Select Project</h3>
          </div>
          <div class="p-2 max-h-80 overflow-y-auto">
            <!-- Clear option -->
            <button
              v-if="hasProjectFocus"
              @click="clearProjectFocus(); showProjectPicker = false"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left text-slate-500"
            >
              <div class="w-5 h-5 flex items-center justify-center">
                <Icon name="heroicons:x-mark" class="w-4 h-4" />
              </div>
              <span class="text-sm">Clear focus</span>
            </button>
            <div v-if="hasProjectFocus" class="my-1 border-t border-slate-100"></div>
            <!-- Projects -->
            <button
              v-for="project in projects"
              :key="project.id"
              @click="selectProject(project.id)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left"
              :class="focusState.project?.id === project.id && 'bg-blue-50'"
            >
              <div class="w-6 h-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span class="text-xs text-blue-600 font-medium">{{ project.title.charAt(0) }}</span>
              </div>
              <span class="text-sm text-slate-900 truncate">{{ project.title }}</span>
              <Icon 
                v-if="focusState.project?.id === project.id"
                name="heroicons:check" 
                class="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" 
              />
            </button>
            <div v-if="!projects.length" class="px-3 py-6 text-sm text-slate-400 text-center">
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
        class="fixed inset-0 z-50 flex items-start justify-center pt-16"
        @click.self="showLanePicker = false"
      >
        <div class="absolute inset-0 bg-black/20" @click="showLanePicker = false"></div>
        <div class="relative bg-white rounded-xl shadow-xl w-72 overflow-hidden">
          <div class="p-4 border-b border-slate-100">
            <h3 class="text-sm font-medium text-slate-900">Switch Activity</h3>
          </div>
          <div class="p-2">
            <button
              v-for="lane in lanes"
              :key="lane"
              @click="selectLane(lane)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50"
              :class="focusState.lane?.type === lane && 'bg-slate-100'"
            >
              <div class="w-5 h-5 flex items-center justify-center">
                <Icon :name="LANE_ICONS[lane]" class="w-4 h-4 text-slate-500" />
              </div>
              <span class="text-sm text-slate-900">{{ LANE_LABELS[lane] }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Task Action Modal (Switch or Complete) -->
    <Teleport to="body">
      <div
        v-if="showTaskActionModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="showTaskActionModal = false"
      >
        <div class="absolute inset-0 bg-black/30" @click="showTaskActionModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-[26rem] overflow-hidden">
          <!-- Header -->
          <div class="p-5 bg-gradient-to-br from-emerald-50 to-teal-50">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Icon name="heroicons:bolt" class="w-5 h-5 text-emerald-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-900 truncate">
                  {{ focusState.task?.title }}
                </p>
                <p class="text-xs text-slate-500 mt-0.5">{{ durationDisplay }} focused</p>
              </div>
            </div>
          </div>

          <!-- Comment -->
          <div class="p-4">
            <label class="block text-sm font-medium text-slate-700 mb-2">
              Quick note <span class="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              v-model="actionComment"
              placeholder="What did you work on? Any blockers?"
              rows="2"
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="px-4 pb-4 space-y-3">
            <!-- Complete Task -->
            <div>
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Complete task</p>
              <div class="flex flex-wrap gap-2">
                <button
                  @click="handleComplete()"
                  class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Icon name="heroicons:check" class="w-4 h-4" />
                  Mark done
                </button>
                <button
                  v-for="lane in lanes"
                  :key="lane"
                  @click="handleComplete(lane)"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                >
                  <Icon :name="LANE_ICONS[lane]" class="w-3.5 h-3.5" />
                  {{ LANE_LABELS[lane] }}
                </button>
              </div>
            </div>

            <!-- Switch (pause task) -->
            <div>
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Switch (pause task)</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="lane in lanes"
                  :key="lane"
                  @click="handleSwitch(lane)"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  <Icon :name="LANE_ICONS[lane]" class="w-3.5 h-3.5" />
                  {{ LANE_LABELS[lane] }}
                </button>
              </div>
            </div>
          </div>

          <!-- Cancel -->
          <div class="p-4 border-t border-slate-100">
            <button
              @click="showTaskActionModal = false"
              class="w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
