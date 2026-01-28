<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = defineProps<{
  projects: ItemNode[]
}>()

const emit = defineEmits<{
  openProject: [project: ItemNode]
  openDetail: [project: ItemNode]
  createProject: []
}>()

// Summary metrics
const metrics = computed(() => {
  const active = props.projects.filter(p => p.status === 'in_progress').length
  const atRisk = props.projects.filter(p => p.confidence < 50 || p.status === 'blocked').length
  const blocked = props.projects.filter(p => p.status === 'blocked').length
  const done = props.projects.filter(p => p.status === 'done').length
  const total = props.projects.length
  
  return { active, atRisk, blocked, done, total }
})

// Sort projects: blocked first, then by confidence (lowest first), then active
const sortedProjects = computed(() => {
  return [...props.projects].sort((a, b) => {
    // Blocked items first
    if (a.status === 'blocked' && b.status !== 'blocked') return -1
    if (b.status === 'blocked' && a.status !== 'blocked') return 1
    // Then by confidence (needs attention first)
    if (a.confidence !== b.confidence) return a.confidence - b.confidence
    // Then by progress
    return (b.progress || 0) - (a.progress || 0)
  })
})

// Get status indicator
const getStatusIndicator = (project: ItemNode) => {
  if (project.status === 'blocked') return { color: 'bg-rose-500', label: 'Blocked', textColor: 'text-rose-600' }
  if (project.status === 'done') return { color: 'bg-emerald-500', label: 'Complete', textColor: 'text-emerald-600' }
  if (project.confidence < 50) return { color: 'bg-amber-500', label: 'At Risk', textColor: 'text-amber-600' }
  if (project.status === 'in_progress') return { color: 'bg-blue-500', label: 'On Track', textColor: 'text-blue-600' }
  return { color: 'bg-slate-400', label: 'Not Started', textColor: 'text-slate-500' }
}

// Format date
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Summary Metrics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl border border-slate-100 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Icon name="heroicons:play" class="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-slate-900">{{ metrics.active }}</div>
            <div class="text-xs text-slate-500">Active</div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl border border-slate-100 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-slate-900">{{ metrics.atRisk }}</div>
            <div class="text-xs text-slate-500">At Risk</div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl border border-slate-100 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
            <Icon name="heroicons:no-symbol" class="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-slate-900">{{ metrics.blocked }}</div>
            <div class="text-xs text-slate-500">Blocked</div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl border border-slate-100 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-slate-900">{{ metrics.done }}</div>
            <div class="text-xs text-slate-500">Complete</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Projects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="project in sortedProjects"
        :key="project.id"
        class="group bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
        @click="emit('openProject', project)"
      >
        <!-- Card Header -->
        <div class="p-5">
          <div class="flex items-start justify-between mb-3">
            <!-- Status badge -->
            <div class="flex items-center gap-2">
              <span 
                :class="['w-2 h-2 rounded-full', getStatusIndicator(project).color]"
              />
              <span :class="['text-xs font-medium', getStatusIndicator(project).textColor]">
                {{ getStatusIndicator(project).label }}
              </span>
            </div>
            
            <!-- Actions -->
            <button 
              @click.stop="emit('openDetail', project)"
              class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Title -->
          <h3 class="text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
            {{ project.title }}
          </h3>
          
          <!-- Description (truncate at first newline) -->
          <p v-if="project.description" class="text-sm text-slate-500 truncate mb-4">
            {{ project.description.split('\n')[0] }}{{ project.description.includes('\n') ? '...' : '' }}
          </p>
          
          <!-- Progress -->
          <div class="mb-4">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="text-slate-500">Progress</span>
              <span class="font-medium text-slate-700">{{ project.progress || 0 }}%</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-500"
                :class="project.status === 'done' ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'"
                :style="{ width: `${project.progress || 0}%` }"
              />
            </div>
          </div>
          
          <!-- Activity Heatmap -->
          <div class="mb-4">
            <UiActivityHeatmap :item-id="project.id" :days="14" />
          </div>
          
          <!-- Footer -->
          <div class="flex items-center justify-between pt-3 border-t border-slate-100">
            <!-- Team -->
            <div class="flex items-center gap-2">
              <div v-if="project.assignees?.length" class="flex -space-x-2">
                <div 
                  v-for="assignee in project.assignees.slice(0, 3)" 
                  :key="assignee.id"
                  class="w-7 h-7 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"
                  :title="assignee.name"
                >
                  <span class="text-[10px] text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
                </div>
                <div 
                  v-if="project.assignees.length > 3"
                  class="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center"
                >
                  <span class="text-[10px] text-slate-600 font-medium">+{{ project.assignees.length - 3 }}</span>
                </div>
              </div>
              <span v-else class="text-xs text-slate-400">No team</span>
            </div>
            
            <!-- Meta -->
            <div class="flex items-center gap-3 text-xs">
              <!-- Due date -->
              <div v-if="project.dueDate" class="flex items-center gap-1 text-slate-500">
                <Icon name="heroicons:calendar" class="w-3.5 h-3.5" />
                <span>{{ formatDate(project.dueDate) }}</span>
              </div>
              
              <!-- Confidence -->
              <div class="flex items-center gap-1">
                <UiConfidenceRing :percent="project.confidence" />
              </div>
              
              <!-- Children count -->
              <div v-if="project.childrenCount" class="flex items-center gap-1 text-slate-500">
                <Icon name="heroicons:square-3-stack-3d" class="w-3.5 h-3.5" />
                <span>{{ project.childrenCount }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Blocked indicator bar -->
        <div 
          v-if="project.status === 'blocked'" 
          class="h-1 bg-gradient-to-r from-rose-400 to-rose-500"
        />
        <div 
          v-else-if="project.confidence < 50" 
          class="h-1 bg-gradient-to-r from-amber-400 to-amber-500"
        />
      </div>
      
      <!-- New Project Card -->
      <button
        @click="emit('createProject')"
        class="flex flex-col items-center justify-center min-h-[200px] bg-white/50 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-white/80 transition-all group"
      >
        <div class="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center mb-3 transition-colors">
          <Icon name="heroicons:plus" class="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
        </div>
        <span class="text-sm font-medium text-slate-400 group-hover:text-slate-600">New Project</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
