<script setup lang="ts">
import type { MessageReaction } from '~/composables/useChannels'

const props = defineProps<{
  reactions: MessageReaction[]
  currentUserId?: string
}>()

const emit = defineEmits<{
  toggle: [emoji: string]
}>()

// Check if current user has reacted with this emoji
const hasReacted = (reaction: MessageReaction) => {
  return props.currentUserId && reaction.users.some(u => u.id === props.currentUserId)
}

// Format user names for tooltip
const formatUsers = (reaction: MessageReaction) => {
  const names = reaction.users.map(u => u.name || 'Unknown').slice(0, 10)
  if (reaction.users.length > 10) {
    names.push(`and ${reaction.users.length - 10} more`)
  }
  return names.join(', ')
}
</script>

<template>
  <div v-if="reactions && reactions.length > 0" class="flex flex-wrap gap-1 mt-1">
    <button
      v-for="reaction in reactions"
      :key="reaction.emoji"
      :class="[
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors',
        hasReacted(reaction)
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      ]"
      :title="formatUsers(reaction)"
      @click="emit('toggle', reaction.emoji)"
    >
      <span>{{ reaction.emoji }}</span>
      <span class="font-medium">{{ reaction.count }}</span>
    </button>
  </div>
</template>
