<script setup lang="ts">
import { TEMPERATURE_CONFIG } from '~/types'
import type { Item } from '~/types'

const props = defineProps<{
  temperature: Item['temperature']
  showLabel?: boolean
}>()

const config = computed(() => TEMPERATURE_CONFIG[props.temperature])
</script>

<template>
  <div class="group relative flex items-center gap-1.5">
    <div 
      :class="[
        'w-1.5 h-1.5 rounded-full',
        config.color,
        temperature === 'hot' || temperature === 'critical' ? 'animate-pulse' : ''
      ]"
    />
    <span 
      v-if="showLabel"
      :class="['text-[10px] font-normal tracking-wide', config.textColor]"
    >
      {{ config.label }}
    </span>
  </div>
</template>
