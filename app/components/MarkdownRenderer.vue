<script setup lang="ts">
const props = defineProps<{
  content: string
  class?: string
}>()

const rendered = computed(() => {
  if (!props.content) return ''

  // Placeholder system: extract code blocks and inline code first to protect them
  const placeholders: string[] = []
  const placeholder = (html: string) => {
    const idx = placeholders.length
    placeholders.push(html)
    return `\x00PH${idx}\x00`
  }

  let html = props.content

  // 1. Extract fenced code blocks BEFORE HTML escaping (so code content stays raw)
  html = html.replace(/^\s*```(\w*)[^\S\n]*\r?\n([\s\S]*?)^\s*```\s*$/gm, (_match, lang, code) => {
    const escaped = code.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return placeholder(
      `<pre class="bg-slate-100 dark:bg-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto my-2 text-slate-700 dark:text-zinc-300"><code>${escaped}</code></pre>`
    )
  })

  // 2. Escape HTML in remaining content
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 3. Extract inline code (protect from further processing)
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    return placeholder(
      `<code class="bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-xs font-mono">${code}</code>`
    )
  })

  // 4. Block-level elements (all tolerate leading whitespace via ^\s*)

  // Headings (### before ## before #)
  html = html.replace(/^\s*### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-4 mb-1.5">$1</h4>')
  html = html.replace(/^\s*## (.+)$/gm, '<h3 class="text-base font-semibold text-slate-900 dark:text-zinc-100 mt-4 mb-1.5">$1</h3>')
  html = html.replace(/^\s*# (.+)$/gm, '<h2 class="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-4 mb-2">$1</h2>')

  // Horizontal rules (--- or *** or ___ on their own line)
  html = html.replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, '<hr class="border-slate-200 dark:border-white/[0.08] my-4" />')

  // Blockquotes (> text) — note: > is escaped to &gt;
  html = html.replace(/^\s*&gt;\s?(.+)$/gm, '<blockquote class="border-l-2 border-slate-300 dark:border-zinc-600 pl-3 text-slate-500 dark:text-zinc-400 italic my-2">$1</blockquote>')

  // Unordered lists (- item or * item)
  html = html.replace(/^\s*[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-slate-600 dark:text-zinc-400">$1</li>')
  html = html.replace(/((?:<li class="ml-4 list-disc[^"]*">.*<\/li>\n?)+)/g, (match) => `<ul class="my-2 space-y-1">${match}</ul>`)

  // Ordered lists (1. item)
  html = html.replace(/^\s*\d+\.\s(.+)$/gm, '<li class="ml-4 list-decimal text-slate-600 dark:text-zinc-400">$1</li>')
  html = html.replace(/((?:<li class="ml-4 list-decimal[^"]*">.*<\/li>\n?)+)/g, (match) => `<ol class="my-2 space-y-1">${match}</ol>`)

  // 5. Inline elements

  // Bold + italic (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-semibold text-slate-800 dark:text-zinc-200"><em>$1</em></strong>')
  // Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-800 dark:text-zinc-200">$1</strong>')
  // Italic (*text*)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')

  // Strikethrough (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through text-slate-400 dark:text-zinc-500">$1</del>')

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')

  // Auto-link bare URLs (http/https) — simple version without lookbehinds for browser compat
  html = html.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/gm, '$1<a href="$2" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">$2</a>')

  // 6. Line breaks
  html = html.replace(/\n\n+/g, '</p><p class="mt-2.5">')
  html = html.replace(/\n/g, '<br />')

  // 7. Wrap in paragraph
  html = `<p>${html}</p>`

  // 8. Clean up: unwrap block elements from paragraphs
  const blockTags = ['h2', 'h3', 'h4', 'pre', 'ul', 'ol', 'blockquote', 'hr']
  for (const tag of blockTags) {
    const openPattern = tag === 'hr'
      ? /<p>(<hr[^>]*\/>)/g
      : new RegExp(`<p>(<${tag}[\\s>])`, 'g')
    html = html.replace(openPattern, '$1')

    if (tag !== 'hr') {
      html = html.replace(new RegExp(`(</${tag}>)</p>`, 'g'), '$1')
    } else {
      html = html.replace(/(<hr[^>]*\/>)\s*<\/p>/g, '$1')
    }
  }

  // Clean empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '')
  // Clean <br> at start/end of paragraphs
  html = html.replace(/<p><br \/>/g, '<p>')
  html = html.replace(/<br \/><\/p>/g, '</p>')

  // 9. Restore placeholders
  html = html.replace(/\x00PH(\d+)\x00/g, (_match, idx) => placeholders[parseInt(idx)])

  return html
})
</script>

<template>
  <div :class="props.class" class="markdown-content" v-html="rendered" />
</template>
