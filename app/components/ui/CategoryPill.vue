<script setup lang="ts">
import { CATEGORY_COLORS } from '~/types'

const props = defineProps<{
  category: string
}>()

const colorClass = computed(() => 
  CATEGORY_COLORS[props.category] ?? CATEGORY_COLORS.Product
)
</script>

<template>
  <span 
    :class="[
      'px-2 py-0.5 rounded-full text-[10px] font-normal border',
      colorClass
    ]"
  >
    {{ category }}
  </span>
</template>
