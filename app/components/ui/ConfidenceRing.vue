<script setup lang="ts">
const props = defineProps<{
  percent: number
}>()

const radius = 10
const stroke = 1.5
const normalizedRadius = radius - stroke
const circumference = normalizedRadius * 2 * Math.PI
const strokeDashoffset = computed(() => 
  circumference - (props.percent / 100) * circumference
)

const colorClass = computed(() => {
  if (props.percent >= 85) return 'text-emerald-400'
  if (props.percent >= 60) return 'text-amber-400'
  return 'text-rose-400'
})
</script>

<template>
  <div class="relative flex items-center justify-center w-6 h-6 group/confidence cursor-help">
    <svg :height="radius * 2" :width="radius * 2" class="rotate-[-90deg]">
      <!-- Background ring -->
      <circle
        stroke="currentColor"
        fill="transparent"
        :stroke-width="stroke"
        class="text-slate-100"
        :r="normalizedRadius"
        :cx="radius"
        :cy="radius"
      />
      <!-- Progress ring -->
      <circle
        stroke="currentColor"
        fill="transparent"
        :stroke-width="stroke"
        :stroke-dasharray="circumference + ' ' + circumference"
        :style="{ strokeDashoffset }"
        :class="[colorClass, 'transition-all duration-500']"
        stroke-linecap="round"
        :r="normalizedRadius"
        :cx="radius"
        :cy="radius"
      />
    </svg>
    <span class="absolute text-[8px] font-normal text-slate-400">
      {{ percent }}
    </span>
    
    <!-- Tooltip -->
    <div class="absolute bottom-full mb-2 hidden group-hover/confidence:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none">
      Confidence: how certain is this estimate
    </div>
  </div>
</template>
