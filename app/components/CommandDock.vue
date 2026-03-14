<template>
  <div class="fixed bottom-6 right-6 z-50">
    <!-- Active count badge — outside overflow-hidden so it isn't clipped -->
    <span
      v-if="activeCount > 0 && !terminalOpen"
      class="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white dark:ring-zinc-950 z-20"
    >
      {{ activeCount }}
    </span>

    <div class="flex flex-col items-center rounded-2xl shadow-xl bg-white/95 backdrop-blur-xl border border-slate-200 dark:bg-zinc-950/90 dark:border-white/10 overflow-hidden">

      <!-- Terminal button -->
      <button
        @click="toggleTerminal"
        :title="terminalOpen ? 'Close Terminals' : 'Agent Terminals'"
        class="relative flex items-center justify-center w-11 h-11 transition-colors duration-200"
        :class="terminalOpen
          ? 'text-violet-600 dark:text-violet-300'
          : hasTerminals
            ? 'text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'
            : 'text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'"
      >
        <!-- Active tint -->
        <div v-if="terminalOpen" class="absolute inset-0 bg-violet-50 dark:bg-violet-600/20 pointer-events-none" />

        <div class="relative inline-flex items-center justify-center leading-none z-10">
          <Icon
            :name="terminalOpen ? 'heroicons:x-mark' : 'heroicons:command-line'"
            class="w-4 h-4 transition-transform duration-200"
          />
          <span
            v-if="!terminalOpen && activeCount > 0"
            class="absolute inset-0 rounded-full bg-violet-400/50 dark:bg-violet-500/50 animate-ping"
            style="animation-duration: 2s"
          />
        </div>
      </button>

      <!-- Divider -->
      <div class="w-5 h-px bg-slate-200 dark:bg-white/[0.08] shrink-0" />

      <!-- Quick Chat button -->
      <button
        @click="toggleChat"
        :title="chatOpen ? 'Close Quick Chat' : 'Quick Chat'"
        class="relative flex items-center justify-center w-11 h-11 transition-colors duration-200"
        :class="chatOpen
          ? 'text-clawlab-600 dark:text-clawlab-400'
          : 'text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'"
      >
        <!-- Active tint -->
        <div v-if="chatOpen" class="absolute inset-0 bg-clawlab-50 dark:bg-clawlab-500/15 pointer-events-none" />

        <div class="relative inline-flex items-center justify-center leading-none z-10">
          <Icon
            :name="chatOpen ? 'heroicons:x-mark' : 'heroicons:chat-bubble-left-ellipsis'"
            class="w-4 h-4 transition-transform duration-200"
          />
        </div>
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useAgentTerminals } from '~/composables/useAgentTerminals'
import { useQuickChat } from '~/composables/useQuickChat'

const { isOpen: terminalOpen, activeCount, hasTerminals, toggle: toggleTerminal } = useAgentTerminals()
const { isOpen: chatOpen, toggle: toggleChat } = useQuickChat()
</script>
