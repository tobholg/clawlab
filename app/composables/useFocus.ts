// Two-layer focus system composable
// Layer 1: Project context (sticky) - persists across activity switches
// Layer 2: Activity (fluid) - either a task OR a lane

export type FocusLane = 'GENERAL' | 'MEETING' | 'ADMIN' | 'LEARNING' | 'BREAK'

export interface ProjectFocus {
  id: string
  title: string
  workspaceId?: string
  since: Date
}

export interface TaskFocus {
  id: string
  title: string
  status?: string
  since: Date
}

export interface LaneFocus {
  type: FocusLane
  since: Date
}

export interface FocusState {
  project: ProjectFocus | null
  task: TaskFocus | null
  lane: LaneFocus | null
  activityStart: Date | null
}

export interface TeamMemberFocus {
  userId: string
  name: string
  avatar: string | null
  project: { id: string; title: string; since: Date } | null
  task: { id: string; title: string; since: Date } | null
  lane: { type: FocusLane; since: Date } | null
  isFocused: boolean
  activityLabel: string | null
}

const LANE_LABELS: Record<FocusLane, string> = {
  GENERAL: 'General',
  MEETING: 'Meeting',
  ADMIN: 'Admin',
  LEARNING: 'Learning',
  BREAK: 'Break',
}

const LANE_ICONS: Record<FocusLane, string> = {
  GENERAL: 'heroicons:square-3-stack-3d',
  MEETING: 'heroicons:users',
  ADMIN: 'heroicons:clipboard-document-list',
  LEARNING: 'heroicons:academic-cap',
  BREAK: 'heroicons:pause-circle',
}

export function useFocus() {
  // Current user ID (will come from auth)
  const currentUserId = useState<string>('currentUserId', () => 'demo-user')
  
  // Focus state
  const focusState = useState<FocusState>('focusState', () => ({
    project: null,
    task: null,
    lane: null,
    activityStart: null,
  }))
  
  // Team presence
  const teamFocus = useState<TeamMemberFocus[]>('teamFocus', () => [])
  
  const isLoading = ref(false)

  // Computed helpers
  const hasProjectFocus = computed(() => !!focusState.value.project)
  const hasTaskFocus = computed(() => !!focusState.value.task)
  const hasLaneFocus = computed(() => !!focusState.value.lane)
  const currentActivity = computed(() => focusState.value.task || focusState.value.lane)
  
  const activityLabel = computed(() => {
    if (focusState.value.task) return focusState.value.task.title
    if (focusState.value.lane) return LANE_LABELS[focusState.value.lane.type]
    return null
  })

  // Duration formatting
  const formatDuration = (since: Date | null): string => {
    if (!since) return ''
    const now = new Date()
    const diffMs = now.getTime() - new Date(since).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m`
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const projectDuration = computed(() => 
    formatDuration(focusState.value.project?.since ?? null)
  )
  
  const activityDuration = computed(() => 
    formatDuration(focusState.value.activityStart)
  )

  // Load current focus state
  const loadFocusState = async () => {
    try {
      const data = await $fetch(`/api/focus/current?userId=${currentUserId.value}`)
      focusState.value = {
        project: data.project ? {
          ...data.project,
          since: new Date(data.project.since),
        } : null,
        task: data.task ? {
          ...data.task,
          since: new Date(data.task.since),
        } : null,
        lane: data.lane ? {
          type: data.lane.type as FocusLane,
          since: new Date(data.lane.since),
        } : null,
        activityStart: data.activityStart ? new Date(data.activityStart) : null,
      }
    } catch (e) {
      console.log('Could not load focus state:', e)
    }
  }

  // Load team presence
  const loadTeamFocus = async (workspaceId: string) => {
    try {
      const data = await $fetch(`/api/focus/team?workspaceId=${workspaceId}`)
      teamFocus.value = data.members.map((m: any) => ({
        ...m,
        project: m.project ? { ...m.project, since: new Date(m.project.since) } : null,
        task: m.task ? { ...m.task, since: new Date(m.task.since) } : null,
        lane: m.lane ? { ...m.lane, since: new Date(m.lane.since) } : null,
      }))
    } catch (e) {
      console.log('Could not load team focus:', e)
    }
  }

  // Start project focus
  const startProjectFocus = async (projectId: string) => {
    isLoading.value = true
    try {
      const result = await $fetch('/api/focus/project', {
        method: 'POST',
        body: { userId: currentUserId.value, projectId }
      })
      
      focusState.value = {
        project: {
          id: result.projectId,
          title: result.projectTitle,
          since: new Date(result.projectFocusStart),
        },
        task: null,
        lane: { type: 'GENERAL', since: new Date(result.activityStart) },
        activityStart: new Date(result.activityStart),
      }
      
      return result
    } finally {
      isLoading.value = false
    }
  }

  // Clear project focus
  const clearProjectFocus = async () => {
    isLoading.value = true
    try {
      await $fetch('/api/focus/project', {
        method: 'POST',
        body: { userId: currentUserId.value, projectId: null }
      })
      
      focusState.value = {
        project: null,
        task: null,
        lane: null,
        activityStart: null,
      }
    } finally {
      isLoading.value = false
    }
  }

  // Start task focus
  const startTaskFocus = async (taskId: string) => {
    isLoading.value = true
    try {
      const result = await $fetch('/api/focus/task', {
        method: 'POST',
        body: { userId: currentUserId.value, taskId }
      })
      
      // Update project if it changed
      if (result.projectId) {
        focusState.value.project = {
          id: result.projectId,
          title: result.projectTitle,
          since: focusState.value.project?.since ?? new Date(),
        }
      }
      
      focusState.value.task = {
        id: result.taskId,
        title: result.taskTitle,
        since: new Date(result.activityStart),
      }
      focusState.value.lane = null
      focusState.value.activityStart = new Date(result.activityStart)
      
      return result
    } finally {
      isLoading.value = false
    }
  }

  // Switch to lane
  const switchToLane = async (lane: FocusLane) => {
    isLoading.value = true
    try {
      const result = await $fetch('/api/focus/lane', {
        method: 'POST',
        body: { userId: currentUserId.value, lane }
      })
      
      focusState.value.task = null
      focusState.value.lane = {
        type: result.lane as FocusLane,
        since: new Date(result.activityStart),
      }
      focusState.value.activityStart = new Date(result.activityStart)
      
      return result
    } finally {
      isLoading.value = false
    }
  }

  // Complete current task
  const completeTask = async (comment?: string, markTaskDone = true) => {
    if (!focusState.value.task) {
      throw new Error('No active task to complete')
    }
    
    isLoading.value = true
    try {
      const result = await $fetch('/api/focus/complete-task', {
        method: 'POST',
        body: { 
          userId: currentUserId.value, 
          comment,
          markTaskDone,
        }
      })
      
      focusState.value.task = null
      focusState.value.lane = {
        type: 'GENERAL',
        since: new Date(),
      }
      focusState.value.activityStart = new Date()
      
      return result
    } finally {
      isLoading.value = false
    }
  }

  // End focus (activity only or everything)
  const endFocus = async (comment?: string, endProject = false) => {
    isLoading.value = true
    try {
      await $fetch('/api/focus/end', {
        method: 'POST',
        body: { 
          userId: currentUserId.value, 
          comment,
          endProject,
        }
      })
      
      if (endProject) {
        focusState.value = {
          project: null,
          task: null,
          lane: null,
          activityStart: null,
        }
      } else {
        focusState.value.task = null
        focusState.value.lane = focusState.value.project ? {
          type: 'GENERAL',
          since: new Date(),
        } : null
        focusState.value.activityStart = focusState.value.project ? new Date() : null
      }
    } finally {
      isLoading.value = false
    }
  }

  // Check if focused on specific item
  const isFocusedOnTask = (taskId: string) => focusState.value.task?.id === taskId
  const isFocusedOnProject = (projectId: string) => focusState.value.project?.id === projectId

  return {
    // State
    currentUserId,
    focusState,
    teamFocus,
    isLoading,
    
    // Computed
    hasProjectFocus,
    hasTaskFocus,
    hasLaneFocus,
    currentActivity,
    activityLabel,
    projectDuration,
    activityDuration,
    
    // Actions
    loadFocusState,
    loadTeamFocus,
    startProjectFocus,
    clearProjectFocus,
    startTaskFocus,
    switchToLane,
    completeTask,
    endFocus,
    
    // Helpers
    isFocusedOnTask,
    isFocusedOnProject,
    formatDuration,
    
    // Constants
    LANE_LABELS,
    LANE_ICONS,
  }
}
