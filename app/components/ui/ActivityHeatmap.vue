<script setup lang="ts">
interface HeatmapDay {
  date: string
  hours: number
  intensity: number // 0-4
  userCount: number
}

const props = defineProps<{
  itemId: string
  days?: number
  compact?: boolean
}>()

const { data: activityData } = useFetch(`/api/items/${props.itemId}/activity`, {
  query: { days: props.days ?? 14 },
  lazy: true,
})

// Intensity to color mapping (GitHub-style greens, but using blue for Context brand)
const intensityColors = [
  'bg-slate-100',      // 0 - no activity
  'bg-blue-200',       // 1 - light
  'bg-blue-300',       // 2 - medium
  'bg-blue-400',       // 3 - high
  'bg-blue-500',       // 4 - very high
]

const getColor = (intensity: number) => intensityColors[Math.min(intensity, 4)]
</script>

<template>
  <div class="flex items-center gap-0.5" :title="`${activityData?.totalHours ?? 0}h focus over ${days ?? 14} days`">
    <template v-if="activityData?.heatmap">
      <div
        v-for="day in activityData.heatmap"
        :key="day.date"
        :class="[
          'rounded-sm transition-colors',
          getColor(day.intensity),
          compact ? 'w-1.5 h-1.5' : 'w-2 h-2'
        ]"
        :title="`${day.date}: ${day.hours}h`"
      />
    </template>
    <template v-else>
      <!-- Skeleton loading -->
      <div
        v-for="i in (days ?? 14)"
        :key="i"
        :class="[
          'rounded-sm bg-slate-100 animate-pulse',
          compact ? 'w-1.5 h-1.5' : 'w-2 h-2'
        ]"
      />
    </template>
  </div>
</template>
