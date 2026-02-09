<script setup lang="ts">
const props = defineProps<{
  content: string
  class?: string
}>()

const rendered = computed(() => {
  if (!props.content) return ''

  let html = props.content
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto my-2"><code>${code.trim()}</code></pre>`
  })

  // Inline code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-0.5 rounded text-xs font-mono">$1</code>')

  // Headings (###, ##, #)
  html = html.replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1">$1</h3>')

  // Bold + italic (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-semibold"><em>$1</em></strong>')
  // Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  // Italic (*text*)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Strikethrough (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through text-slate-400">$1</del>')

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')

  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="my-1 space-y-0.5">${match}</ul>`)

  // Ordered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
  html = html.replace(/(<li class="ml-4 list-decimal">.*<\/li>\n?)+/g, (match) => `<ol class="my-1 space-y-0.5">${match}</ol>`)

  // Blockquotes (> text)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-2 border-slate-300 dark:border-slate-600 pl-3 text-slate-500 dark:text-slate-400 italic my-1">$1</blockquote>')

  // Horizontal rules (--- or ***)
  html = html.replace(/^(---|\*\*\*)$/gm, '<hr class="border-slate-200 dark:border-slate-700 my-3" />')

  // Line breaks: double newline = paragraph break, single newline = <br>
  html = html.replace(/\n\n/g, '</p><p class="mt-2">')
  html = html.replace(/\n/g, '<br />')

  // Wrap in paragraph
  html = `<p>${html}</p>`

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[34])/g, '$1')
  html = html.replace(/(<\/h[34]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul)/g, '$1')
  html = html.replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ol)/g, '$1')
  html = html.replace(/(<\/ol>)<\/p>/g, '$1')
  html = html.replace(/<p>(<blockquote)/g, '$1')
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1')
  html = html.replace(/<p>(<hr)/g, '$1')
  html = html.replace(/(\/> )<\/p>/g, '$1')

  return html
})
</script>

<template>
  <div :class="props.class" class="markdown-content" v-html="rendered" />
</template>
