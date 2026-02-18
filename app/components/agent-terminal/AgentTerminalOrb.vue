<template>
  <button
    @click="toggle"
    :title="isOpen ? 'Close Command Central' : 'Agent Terminals'"
    :class="[
      'fixed bottom-6 left-6 w-12 h-12 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center z-50',
      isOpen
        ? 'bg-violet-600 text-white scale-90'
        : hasTerminals
          ? 'bg-violet-600 text-white hover:scale-105 hover:shadow-xl hover:shadow-violet-500/20'
          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:scale-105 hover:shadow-xl border border-white/[0.06]'
    ]"
  >
    <!-- Terminal icon -->
    <Icon
      :name="isOpen ? 'heroicons:x-mark' : 'heroicons:command-line'"
      class="w-5 h-5 transition-transform duration-300"
    />

    <!-- Active count badge -->
    <span
      v-if="!isOpen && activeCount > 0"
      class="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-dm-surface"
    >
      {{ activeCount }}
    </span>

    <!-- Pulse ring when agents are active -->
    <span
      v-if="!isOpen && activeCount > 0"
      class="absolute inset-0 rounded-full bg-violet-500/30 animate-ping"
      style="animation-duration: 2s"
    />
  </button>
</template>

<script setup lang="ts">
import { useAgentTerminals } from '~/composables/useAgentTerminals'

const { isOpen, activeCount, hasTerminals, toggle } = useAgentTerminals()
</script>
