<script setup lang="ts">
import type { Task } from '~/types'

const props = defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  taskClick: [task: Task]
}>()

// Build graph data
const graphData = computed(() => {
  const nodes: { id: string; task: Task; x: number; y: number; level: number }[] = []
  const edges: { from: string; to: string; fromX: number; fromY: number; toX: number; toY: number }[] = []
  
  // Create a map for quick lookup
  const taskMap = new Map(props.tasks.map(t => [t.id, t]))
  
  // Find tasks with dependencies
  const tasksWithDeps = props.tasks.filter(t => t.blocks.length > 0 || t.blockedBy.length > 0)
  
  // If no dependencies, show all tasks
  const relevantTasks = tasksWithDeps.length > 0 ? tasksWithDeps : props.tasks.slice(0, 10)
  
  // Calculate levels (topological sort-ish)
  const levels = new Map<string, number>()
  
  function getLevel(taskId: string, visited = new Set<string>()): number {
    if (visited.has(taskId)) return 0
    if (levels.has(taskId)) return levels.get(taskId)!
    
    visited.add(taskId)
    const task = taskMap.get(taskId)
    if (!task || task.blockedBy.length === 0) {
      levels.set(taskId, 0)
      return 0
    }
    
    const maxBlockerLevel = Math.max(
      ...task.blockedBy.map(id => getLevel(id, visited))
    )
    const level = maxBlockerLevel + 1
    levels.set(taskId, level)
    return level
  }
  
  relevantTasks.forEach(t => getLevel(t.id))
  
  // Group by level
  const byLevel = new Map<number, Task[]>()
  relevantTasks.forEach(t => {
    const level = levels.get(t.id) || 0
    if (!byLevel.has(level)) byLevel.set(level, [])
    byLevel.get(level)!.push(t)
  })
  
  // Position nodes
  const nodeWidth = 180
  const nodeHeight = 80
  const levelGap = 250
  const nodeGap = 100
  
  const maxLevel = Math.max(...Array.from(levels.values()), 0)
  
  byLevel.forEach((tasksAtLevel, level) => {
    const totalHeight = tasksAtLevel.length * nodeHeight + (tasksAtLevel.length - 1) * nodeGap
    const startY = (400 - totalHeight) / 2 // Center vertically
    
    tasksAtLevel.forEach((task, index) => {
      const x = 50 + level * levelGap
      const y = startY + index * (nodeHeight + nodeGap)
      
      nodes.push({
        id: task.id,
        task,
        x,
        y,
        level
      })
    })
  })
  
  // Create edges
  const nodePositions = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]))
  
  relevantTasks.forEach(task => {
    const fromPos = nodePositions.get(task.id)
    if (!fromPos) return
    
    task.blocks.forEach(blockedId => {
      const toPos = nodePositions.get(blockedId)
      if (toPos) {
        edges.push({
          from: task.id,
          to: blockedId,
          fromX: fromPos.x + nodeWidth,
          fromY: fromPos.y + nodeHeight / 2,
          toX: toPos.x,
          toY: toPos.y + nodeHeight / 2
        })
      }
    })
  })
  
  return { nodes, edges, width: (maxLevel + 1) * levelGap + 100, height: 500 }
})

// Status colors
const statusColors: Record<string, string> = {
  'backlog': 'bg-gray-100 border-gray-300',
  'todo': 'bg-blue-50 border-blue-300',
  'in-progress': 'bg-yellow-50 border-yellow-300',
  'review': 'bg-purple-50 border-purple-300',
  'done': 'bg-green-50 border-green-300',
}

const statusTextColors: Record<string, string> = {
  'backlog': 'text-gray-600',
  'todo': 'text-blue-600',
  'in-progress': 'text-yellow-600',
  'review': 'text-purple-600',
  'done': 'text-green-600',
}
</script>

<template>
  <div class="dependency-graph bg-white rounded-xl border border-gray-200 overflow-auto">
    <svg 
      :width="graphData.width" 
      :height="graphData.height"
      class="min-w-full"
    >
      <!-- Edges -->
      <g class="edges">
        <path
          v-for="edge in graphData.edges"
          :key="`${edge.from}-${edge.to}`"
          :d="`M ${edge.fromX} ${edge.fromY} 
               C ${edge.fromX + 50} ${edge.fromY}, 
                 ${edge.toX - 50} ${edge.toY}, 
                 ${edge.toX} ${edge.toY}`"
          fill="none"
          stroke="#cbd5e1"
          stroke-width="2"
          marker-end="url(#arrowhead)"
        />
      </g>
      
      <!-- Arrow marker definition -->
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
        </marker>
      </defs>
      
      <!-- Nodes -->
      <g class="nodes">
        <foreignObject
          v-for="node in graphData.nodes"
          :key="node.id"
          :x="node.x"
          :y="node.y"
          width="180"
          height="80"
        >
          <div 
            class="h-full p-3 rounded-lg border-2 cursor-pointer transition-shadow hover:shadow-md"
            :class="statusColors[node.task.status]"
            @click="emit('taskClick', node.task)"
          >
            <div class="text-sm font-medium text-gray-900 truncate">
              {{ node.task.title }}
            </div>
            <div class="text-xs mt-1 flex items-center gap-2">
              <span 
                class="font-medium"
                :class="statusTextColors[node.task.status]"
              >
                {{ node.task.status.replace('-', ' ') }}
              </span>
              <span class="text-gray-400">·</span>
              <span class="text-gray-500">{{ node.task.progress }}%</span>
            </div>
            <div class="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                class="h-full bg-ctx-500 rounded-full transition-all"
                :style="{ width: `${node.task.progress}%` }"
              />
            </div>
          </div>
        </foreignObject>
      </g>
    </svg>
    
    <!-- Empty state -->
    <div 
      v-if="graphData.nodes.length === 0"
      class="flex items-center justify-center h-64 text-gray-400"
    >
      No tasks with dependencies to display
    </div>
  </div>
</template>

<style scoped>
.dependency-graph {
  min-height: 500px;
}
</style>
