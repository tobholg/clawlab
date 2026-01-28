<script setup lang="ts">
import type { Person } from '~/types'

const props = defineProps<{
  people: Person[]
  max?: number
}>()

const maxVisible = computed(() => props.max ?? 3)
const visible = computed(() => props.people.slice(0, maxVisible.value))
const remaining = computed(() => Math.max(0, props.people.length - maxVisible.value))
</script>

<template>
  <div class="flex -space-x-1.5">
    <img 
      v-for="person in visible"
      :key="person.id"
      :src="person.avatar" 
      :alt="person.name"
      :title="person.name"
      class="w-5 h-5 rounded-full border border-white ring-1 ring-slate-100 object-cover"
    />
    <div 
      v-if="remaining > 0"
      class="w-5 h-5 rounded-full border border-white bg-slate-100 flex items-center justify-center text-[9px] font-normal text-slate-500"
    >
      +{{ remaining }}
    </div>
  </div>
</template>
