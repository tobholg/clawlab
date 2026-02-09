<template>
  <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap',
        message.role === 'user'
          ? 'rounded-tr-sm bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200'
          : 'rounded-tl-sm bg-ctx-50 dark:bg-ctx-900/20 text-slate-700 dark:text-zinc-300 prose prose-sm prose-slate max-w-none'
      ]"
    >
      <!-- User message: plain text -->
      <template v-if="message.role === 'user'">
        {{ message.content }}
      </template>
      
      <!-- Assistant message: render as HTML (markdown processed) -->
      <template v-else>
        <div v-if="message.content" v-html="renderedContent" />
        <span v-else class="text-slate-400 animate-pulse">Thinking...</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { QuickChatMessage } from '~/composables/useQuickChat'

const props = defineProps<{
  message: QuickChatMessage
}>()

// Simple markdown-like rendering (basic)
const renderedContent = computed(() => {
  let content = props.message.content
  
  // Escape HTML
  content = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Code blocks (```...```)
  content = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-slate-100 dark:bg-dm-card rounded-lg p-2 my-2 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`
  })
  
  // Inline code (`...`)
  content = content.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-dm-card px-1 py-0.5 rounded text-xs">$1</code>')
  
  // Bold (**...**)
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  
  // Italic (*...*)
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  
  // Links [text](url)
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-ctx-600 dark:text-ctx-400 hover:underline">$1</a>')
  
  // Line breaks
  content = content.replace(/\n/g, '<br>')
  
  return content
})
</script>
