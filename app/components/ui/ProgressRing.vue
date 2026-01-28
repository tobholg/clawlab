<script setup lang="ts">
const props = defineProps<{
  progress: number
  size?: number
  strokeWidth?: number
}>()

const size = props.size || 40
const strokeWidth = props.strokeWidth || 4
const radius = (size - strokeWidth) / 2
const circumference = radius * 2 * Math.PI
const offset = computed(() => circumference - (props.progress / 100) * circumference)

const progressColor = computed(() => {
  if (props.progress >= 80) return '#22c55e' // green
  if (props.progress >= 50) return '#0ea5e9' // blue
  if (props.progress >= 25) return '#f97316' // orange
  return '#ef4444' // red
})
</script>

<template>
  <div class="progress-ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size">
      <!-- Background circle -->
      <circle
        class="text-gray-200"
        stroke="currentColor"
        fill="transparent"
        :stroke-width="strokeWidth"
        :r="radius"
        :cx="size / 2"
        :cy="size / 2"
      />
      <!-- Progress circle -->
      <circle
        class="progress-ring__circle"
        :stroke="progressColor"
        fill="transparent"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        stroke-linecap="round"
        :r="radius"
        :cx="size / 2"
        :cy="size / 2"
      />
    </svg>
    <span class="absolute text-xs font-medium text-gray-700">
      {{ progress }}%
    </span>
  </div>
</template>
