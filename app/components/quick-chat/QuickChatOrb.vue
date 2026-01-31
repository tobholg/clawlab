<template>
  <button
    @click="toggle"
    :title="isOpen ? 'Close Quick Chat' : 'Quick Chat'"
    :class="[
      'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center z-50',
      isOpen
        ? 'bg-slate-900 text-white scale-90 rotate-90'
        : 'bg-white text-slate-600 hover:scale-105 hover:shadow-xl border border-slate-200'
    ]"
  >
    <Icon
      :name="isOpen ? 'heroicons:x-mark' : 'heroicons:chat-bubble-left-ellipsis'"
      class="w-6 h-6 transition-transform duration-300"
    />
  </button>
</template>

<script setup lang="ts">
import { useQuickChat } from '~/composables/useQuickChat'

const { isOpen, toggle } = useQuickChat()
</script>
