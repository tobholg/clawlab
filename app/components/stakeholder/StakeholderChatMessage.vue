<template>
  <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap',
        message.role === 'user'
          ? 'rounded-tr-sm bg-slate-100 text-slate-700'
          : 'rounded-tl-sm bg-violet-50 text-slate-700 prose prose-sm prose-slate max-w-none'
      ]"
    >
      <!-- User message: plain text -->
      <template v-if="message.role === 'user'">
        {{ message.content }}
      </template>
      
      <!-- Assistant message: render as HTML (markdown processed) -->
      <template v-else>
        <div v-if="displayContent" v-html="renderedContent" />
        <span v-else class="text-slate-400 animate-pulse">Thinking...</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { stripActions, type StakeholderChatMessage } from '~/composables/useStakeholderChat'

const props = defineProps<{
  message: StakeholderChatMessage
}>()

// Strip action blocks from display
const displayContent = computed(() => {
  if (props.message.role === 'user') return props.message.content
  return stripActions(props.message.content)
})

// Simple markdown-like rendering (basic)
const renderedContent = computed(() => {
  let content = displayContent.value
  
  // Escape HTML
  content = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Code blocks (```...```)
  content = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-slate-100 rounded-lg p-2 my-2 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`
  })
  
  // Inline code (`...`)
  content = content.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
  
  // Bold (**...**)
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  
  // Italic (*...*)
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  
  // Links [text](url)
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-violet-600 hover:underline">$1</a>')
  
  // Line breaks
  content = content.replace(/\n/g, '<br>')
  
  return content
})
</script>
