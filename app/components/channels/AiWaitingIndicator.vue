<script setup lang="ts">
const props = defineProps<{
  pending: boolean
  label?: string
}>()
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div v-if="pending" class="px-4 py-1.5">
      <div class="max-w-3xl mx-auto flex items-center gap-2 text-xs text-slate-500">
        <div class="w-5 h-5 rounded-full bg-black flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span class="text-slate-600">Context AI</span>
        <span class="text-slate-400">{{ label || 'thinking' }}</span>
        <span class="ai-dot" style="--delay: 0ms" />
        <span class="ai-dot" style="--delay: 120ms" />
        <span class="ai-dot" style="--delay: 240ms" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ai-dot {
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #cbd5f5;
  animation: aiPulse 1s ease-in-out infinite;
  animation-delay: var(--delay);
}

@keyframes aiPulse {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  40% {
    transform: translateY(-2px);
    opacity: 0.8;
  }
}
</style>
