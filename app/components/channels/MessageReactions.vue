<script setup lang="ts">
import type { MessageReaction } from '~/composables/useChannels'

const props = defineProps<{
  reactions: MessageReaction[]
  currentUserId?: string
}>()

const emit = defineEmits<{
  toggle: [emoji: string]
}>()

// Track which reaction tooltip is shown
const hoveredEmoji = ref<string | null>(null)

// Check if current user has reacted with this emoji
const hasReacted = (reaction: MessageReaction) => {
  return props.currentUserId && reaction.users.some(u => u.id === props.currentUserId)
}

// Get user names for tooltip
const getUsers = (reaction: MessageReaction) => {
  return reaction.users.map(u => u.name || 'Unknown')
}
</script>

<template>
  <div v-if="reactions && reactions.length > 0" class="flex flex-wrap gap-1 mt-1">
    <div
      v-for="reaction in reactions"
      :key="reaction.emoji"
      class="relative"
      @mouseenter="hoveredEmoji = reaction.emoji"
      @mouseleave="hoveredEmoji = null"
    >
      <button
        :class="[
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors',
          hasReacted(reaction)
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        ]"
        @click="emit('toggle', reaction.emoji)"
      >
        <span>{{ reaction.emoji }}</span>
        <span class="font-medium">{{ reaction.count }}</span>
      </button>
      
      <!-- Custom tooltip -->
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div 
          v-if="hoveredEmoji === reaction.emoji"
          class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20"
        >
          <div class="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-xs">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-base">{{ reaction.emoji }}</span>
              <span class="font-medium">{{ reaction.count }}</span>
            </div>
            <div class="text-slate-300 space-y-0.5">
              <div v-for="name in getUsers(reaction).slice(0, 10)" :key="name" class="truncate">
                {{ name }}
              </div>
              <div v-if="reaction.users.length > 10" class="text-slate-400 italic">
                and {{ reaction.users.length - 10 }} more...
              </div>
            </div>
          </div>
          <!-- Arrow -->
          <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div class="border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
