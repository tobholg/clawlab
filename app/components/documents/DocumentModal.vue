<script setup lang="ts">
import type { DocumentDetail, DocumentVersion } from '~/types'

type BlockType = 'paragraph' | 'heading' | 'list-item' | 'table' | 'divider'

type Block = {
  id: string
  type: BlockType
  text: string
  level?: number
  indent?: number
  listStyle?: 'bullet' | 'number'
  checked?: boolean
  table?: string[][]
}

const props = defineProps<{
  open: boolean
  documentId: string | null
}>()

const emit = defineEmits<{
  close: []
  updated: []
  deleted: []
}>()

const { currentUserId } = useFocus()

const documentData = ref<DocumentDetail | null>(null)
const editedTitle = ref('')
const blocks = ref<Block[]>([])
const versions = ref<DocumentVersion[]>([])

const isLoading = ref(false)
const isSaving = ref(false)
const isReadMode = ref(false)
const isInitializing = ref(true)
const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

const showVersions = ref(false)
const showVersionModal = ref(false)
const versionLabel = ref('')
const versionNotes = ref('')
const versionType = ref<'minor' | 'major'>('minor')
const activeBlockMenuId = ref<string | null>(null)

// Drag state for block reordering
const draggedBlockIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)
const dropIndicatorTop = ref(0)
const isDragging = ref(false)
const blocksContainerRef = ref<HTMLElement | null>(null)
const dragAreaRef = ref<HTMLElement | null>(null)

// Slash command menu state
const slashMenuBlockIndex = ref<number | null>(null)
const slashMenuSelectedIndex = ref(0)
const slashMenuOptionRefs = ref<(HTMLElement | null)[]>([])

const slashMenuOptions = [
  { label: 'Text', description: 'Plain text paragraph', type: 'paragraph' as BlockType, icon: 'T' },
  { label: 'Heading 1', description: 'Large section heading', type: 'heading' as BlockType, level: 1, icon: 'H1' },
  { label: 'Heading 2', description: 'Medium section heading', type: 'heading' as BlockType, level: 2, icon: 'H2' },
  { label: 'Heading 3', description: 'Small section heading', type: 'heading' as BlockType, level: 3, icon: 'H3' },
  { label: 'Bullet List', description: 'Simple bullet list', type: 'list-item' as BlockType, listStyle: 'bullet', icon: '•' },
  { label: 'Numbered List', description: 'Numbered list', type: 'list-item' as BlockType, listStyle: 'number', icon: '1.' },
  { label: 'Table', description: 'Add a table', type: 'table' as BlockType, icon: '⊞' },
  { label: 'Divider', description: 'Visual separator', type: 'divider' as BlockType, icon: '—' },
]

const blockRefs = ref<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({})
const tableRefs = ref<Record<string, HTMLInputElement | null>>({})

const isOwner = computed(() => documentData.value?.createdBy?.id === currentUserId.value)
const canEdit = computed(() => !!documentData.value && (!documentData.value.isLocked || isOwner.value))

const createId = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))

const createBlock = (type: BlockType, text = ''): Block => {
  if (type === 'heading') {
    return { id: createId(), type, text, level: 1 }
  }
  if (type === 'list-item') {
    return { id: createId(), type, text, indent: 0, listStyle: 'bullet' }
  }
  if (type === 'table') {
    return { id: createId(), type, text: '', table: [['Header', 'Header'], ['', '']] }
  }
  if (type === 'divider') {
    return { id: createId(), type, text: '' }
  }
  return { id: createId(), type, text }
}

const blockTypeOptions = [
  { label: 'Text', type: 'paragraph' as BlockType },
  { label: 'H1', type: 'heading' as BlockType, level: 1 },
  { label: 'H2', type: 'heading' as BlockType, level: 2 },
  { label: 'H3', type: 'heading' as BlockType, level: 3 },
  { label: 'List', type: 'list-item' as BlockType },
  { label: 'Table', type: 'table' as BlockType },
  { label: 'Divider', type: 'divider' as BlockType },
]

const getBlockLabel = (block: Block) => {
  if (block.type === 'heading') return `H${block.level ?? 1}`
  if (block.type === 'list-item') return block.listStyle === 'number' ? 'List 1' : 'List'
  if (block.type === 'table') return 'Table'
  if (block.type === 'divider') return 'Divider'
  return 'Text'
}

const setBlockType = (index: number, type: BlockType, level?: number) => {
  const block = blocks.value[index]
  if (!block) return

  const textFallback = block.text || (block.table ? block.table.map(row => row.join(' | ')).join('\n') : '')

  block.type = type
  block.level = undefined
  block.indent = undefined
  block.listStyle = undefined
  block.table = undefined

  if (type === 'heading') {
    block.level = level ?? block.level ?? 1
    block.text = textFallback
  } else if (type === 'list-item') {
    block.text = textFallback
    block.indent = 0
    block.listStyle = 'bullet'
  } else if (type === 'table') {
    block.text = ''
    block.table = [['Header', 'Header'], ['', '']]
  } else if (type === 'divider') {
    block.text = ''
  } else {
    block.text = textFallback
  }

  activeBlockMenuId.value = null
  nextTick(() => focusBlock(index, 'end'))
}

const toggleBlockMenu = (blockId: string) => {
  activeBlockMenuId.value = activeBlockMenuId.value === blockId ? null : blockId
}

// Slash command menu handlers
const openSlashMenu = (blockIndex: number) => {
  slashMenuBlockIndex.value = blockIndex
  slashMenuSelectedIndex.value = 0
}

const closeSlashMenu = () => {
  slashMenuBlockIndex.value = null
  slashMenuSelectedIndex.value = 0
  slashMenuOptionRefs.value = []
}

const setSlashMenuOptionRef = (index: number) => (el: HTMLElement | null) => {
  slashMenuOptionRefs.value[index] = el
}

const scrollSlashMenuOptionIntoView = (index: number) => {
  nextTick(() => {
    const el = slashMenuOptionRefs.value[index]
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

const selectSlashOption = (optionIndex: number) => {
  if (slashMenuBlockIndex.value === null) return
  const option = slashMenuOptions[optionIndex]
  if (!option) return

  const block = blocks.value[slashMenuBlockIndex.value]
  if (!block) return

  // Remove the "/" from the text
  block.text = ''

  // Apply the block type
  block.type = option.type
  block.level = undefined
  block.indent = undefined
  block.listStyle = undefined
  block.table = undefined

  if (option.type === 'heading') {
    block.level = option.level ?? 1
  } else if (option.type === 'list-item') {
    block.indent = 0
    block.listStyle = option.listStyle ?? 'bullet'
  } else if (option.type === 'table') {
    block.table = [['Header', 'Header'], ['', '']]
  }

  const focusIndex = slashMenuBlockIndex.value
  closeSlashMenu()
  nextTick(() => focusBlock(focusIndex, 'start'))
}

const parseMarkdownToBlocks = (markdown: string): Block[] => {
  const lines = (markdown ?? '').split('\n')
  const parsed: Block[] = []
  const paragraphBuffer: string[] = []

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      parsed.push(createBlock('paragraph', paragraphBuffer.join('\n')))
      paragraphBuffer.length = 0
    }
  }

  const isTableSeparator = (line: string) => {
    const compact = line.replace(/\s/g, '')
    return /^\|?[-:]+(\|[-:]+)+\|?$/.test(compact)
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      flushParagraph()
      i += 1
      continue
    }

    // Divider (--- or *** or ___)
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      flushParagraph()
      parsed.push({ id: createId(), type: 'divider', text: '' })
      i += 1
      continue
    }

    if (line.startsWith('#')) {
      flushParagraph()
      const level = Math.min(3, line.match(/^#+/)?.[0].length ?? 1)
      parsed.push({ id: createId(), type: 'heading', text: line.slice(level).trim(), level })
      i += 1
      continue
    }

    // Checkbox lines: [ ] or [x] with optional - prefix
    const checkboxMatch = line.match(/^(\s*)(?:[-*]\s+)?\[([ xX])\]\s+(.*)$/)
    if (checkboxMatch) {
      flushParagraph()
      const checked = checkboxMatch[2] !== ' '
      parsed.push({ id: createId(), type: 'list-item', text: checkboxMatch[3] ?? '', indent: 0, listStyle: 'bullet', checked })
      i += 1
      continue
    }

    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
    if (listMatch) {
      flushParagraph()
      const indent = Math.floor((listMatch[1]?.length ?? 0) / 2)
      const listStyle = listMatch[2]?.includes('.') ? 'number' : 'bullet'
      parsed.push({ id: createId(), type: 'list-item', text: listMatch[3] ?? '', indent, listStyle })
      i += 1
      continue
    }

    if (line.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      flushParagraph()
      const rows: string[][] = []
      const headerCells = line.split('|').slice(1, -1).map(cell => cell.trim())
      rows.push(headerCells.length ? headerCells : ['Header'])
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const cells = lines[i].split('|').slice(1, -1).map(cell => cell.trim())
        rows.push(cells.length ? cells : [''])
        i += 1
      }
      parsed.push({ id: createId(), type: 'table', text: '', table: rows })
      continue
    }

    paragraphBuffer.push(line)
    i += 1
  }

  flushParagraph()
  return parsed.length ? parsed : [createBlock('paragraph', '')]
}

// Render inline markdown (bold, italic, code, links, strikethrough) to HTML
const renderInline = (text: string): string => {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Inline code (protect from further processing)
  const codes: string[] = []
  html = html.replace(/`([^`]+)`/g, (_m, code) => {
    codes.push(`<code class="bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-xs font-mono">${code}</code>`)
    return `\x00C${codes.length - 1}\x00`
  })
  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-semibold"><em>$1</em></strong>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through text-slate-400 dark:text-zinc-500">$1</del>')
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')
  // Restore inline code
  html = html.replace(/\x00C(\d+)\x00/g, (_m, idx) => codes[parseInt(idx)])
  return html
}

const getNumberedListValue = (index: number) => {
  const block = blocks.value[index]
  if (!block || block.type !== 'list-item' || block.listStyle !== 'number' || block.checked !== undefined) {
    return 1
  }

  const targetIndent = block.indent ?? 0
  let value = 1

  for (let i = index - 1; i >= 0; i -= 1) {
    const previous = blocks.value[i]
    if (!previous || previous.type !== 'list-item') break

    const previousIndent = previous.indent ?? 0
    if (previousIndent < targetIndent) break
    if (previousIndent > targetIndent) continue
    if (previous.checked !== undefined || previous.listStyle !== 'number') break

    value += 1
  }

  return value
}

const serializeBlocksToMarkdown = (value: Block[]) => {
  const lines: string[] = []

  const pushLine = (line: string) => {
    lines.push(line)
  }

  value.forEach((block) => {
    if (block.type === 'heading') {
      const level = block.level ?? 1
      pushLine(`${'#'.repeat(level)} ${block.text}`)
      return
    }

    if (block.type === 'list-item') {
      const indent = '  '.repeat(block.indent ?? 0)
      const marker = block.listStyle === 'number' ? '1.' : '-'
      pushLine(`${indent}${marker} ${block.text}`)
      return
    }

    if (block.type === 'table' && block.table?.length) {
      const rows = block.table
      const header = rows[0] ?? []
      const headerLine = `| ${header.map(cell => cell.replace(/\|/g, '\\|')).join(' | ')} |`
      const separator = `| ${header.map(() => '---').join(' | ')} |`
      pushLine(headerLine)
      pushLine(separator)
      rows.slice(1).forEach((row) => {
        const rowLine = `| ${row.map(cell => cell.replace(/\|/g, '\\|')).join(' | ')} |`
        pushLine(rowLine)
      })
      return
    }

    if (block.type === 'divider') {
      pushLine('---')
      return
    }

    pushLine(block.text)
  })

  return lines.join('\n')
}

const serializedMarkdown = computed(() => serializeBlocksToMarkdown(blocks.value))

const fetchDocument = async () => {
  if (!props.documentId || !props.open) return
  isLoading.value = true
  try {
    const doc = await $fetch(`/api/documents/${props.documentId}`) as DocumentDetail
    documentData.value = doc
    editedTitle.value = doc.title
    blocks.value = parseMarkdownToBlocks(doc.content)
    isReadMode.value = doc.isLocked || !!(doc.content?.trim())
    await nextTick()
  } catch (e) {
    console.error('Failed to fetch document:', e)
  } finally {
    isLoading.value = false
    isInitializing.value = false
    fetchVersions()
    autoResizeAllTextareas()
  }
}

const fetchVersions = async () => {
  if (!props.documentId) return
  try {
    const data = await $fetch(`/api/documents/${props.documentId}/versions`)
    versions.value = (data as DocumentVersion[]) ?? []
  } catch (e) {
    console.error('Failed to fetch versions:', e)
    versions.value = []
  }
}

const scheduleSave = () => {
  if (!documentData.value || !canEdit.value || isInitializing.value) return
  if (saveTimeout.value) clearTimeout(saveTimeout.value)
  saveTimeout.value = setTimeout(saveDocument, 700)
}

const saveDocument = async () => {
  if (!documentData.value || !canEdit.value) return
  isSaving.value = true
  try {
    const updated = await $fetch(`/api/documents/${documentData.value.id}`, {
      method: 'PATCH',
      body: {
        title: editedTitle.value,
        content: serializedMarkdown.value,
        userId: currentUserId.value,
      },
    }) as DocumentDetail
    documentData.value = updated
    emit('updated')
  } catch (e) {
    console.error('Failed to save document:', e)
  } finally {
    isSaving.value = false
  }
}

const toggleLock = async () => {
  if (!documentData.value) return
  try {
    const updated = await $fetch(`/api/documents/${documentData.value.id}`, {
      method: 'PATCH',
      body: {
        isLocked: !documentData.value.isLocked,
        userId: currentUserId.value,
      },
    }) as DocumentDetail
    documentData.value = updated
    if (updated.isLocked) {
      isReadMode.value = true
    }
    emit('updated')
  } catch (e) {
    console.error('Failed to update lock state:', e)
  }
}

const deleteDocument = async () => {
  if (!documentData.value) return
  const confirmed = window.confirm('Delete this document? This cannot be undone.')
  if (!confirmed) return

  try {
    await $fetch(`/api/documents/${documentData.value.id}`, {
      method: 'DELETE',
    })
    emit('deleted')
    emit('close')
  } catch (e) {
    console.error('Failed to delete document:', e)
  }
}

// Download as markdown
const downloadAsMarkdown = () => {
  const title = editedTitle.value || 'Untitled document'
  const markdown = serializedMarkdown.value
  const content = `# ${title}\n\n${markdown}`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '-').toLowerCase()}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const stripInlineMarkdownForPdf = (value: string) => {
  let text = value ?? ''
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
  text = text.replace(/~~(.+?)~~/g, '$1')
  return text
}

const createDownloadFilename = (title: string) => {
  const slug = title
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .trim()
  return slug || 'untitled-document'
}

const exportToPdf = async () => {
  const title = (editedTitle.value || 'Untitled document').trim() || 'Untitled document'
  const generatedAt = new Date().toLocaleString()

  try {
    const [pdfMakeModule, pdfFontsModule] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ])

    const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule
    const pdfFontsModuleAny = pdfFontsModule as any
    const rawDefault = pdfFontsModuleAny?.default
    const vfs = (
      rawDefault?.pdfMake?.vfs
      ?? rawDefault?.vfs
      ?? pdfFontsModuleAny?.pdfMake?.vfs
      ?? pdfFontsModuleAny?.vfs
      ?? rawDefault
      ?? pdfFontsModuleAny
    )

    if (vfs && typeof pdfMake.addVirtualFileSystem === 'function') {
      pdfMake.addVirtualFileSystem(vfs)
    } else if (vfs) {
      pdfMake.vfs = vfs
    }

    const robotoFonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    }
    if (typeof pdfMake.addFonts === 'function') {
      pdfMake.addFonts(robotoFonts)
    } else {
      pdfMake.fonts = { ...(pdfMake.fonts ?? {}), ...robotoFonts }
    }

    const content: any[] = [
      { text: title, style: 'docTitle' },
      { text: `Exported ${generatedAt}`, style: 'docMeta' },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' },
        ],
        margin: [0, 8, 0, 14],
      },
    ]

    blocks.value.forEach((block, index) => {
      if (block.type === 'heading') {
        const level = Math.min(3, Math.max(1, block.level ?? 1))
        content.push({
          text: stripInlineMarkdownForPdf(block.text),
          style: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3',
        })
        return
      }

      if (block.type === 'list-item') {
        const indent = Math.max(0, block.indent ?? 0) * 14
        const marker = block.checked !== undefined
          ? (block.checked ? '☑' : '☐')
          : (block.listStyle === 'number' ? `${getNumberedListValue(index)}.` : '•')

        content.push({
          columns: [
            { width: 18, text: marker, style: 'listMarker', alignment: 'right' },
            { width: '*', text: stripInlineMarkdownForPdf(block.text), style: 'paragraph' },
          ],
          columnGap: 8,
          margin: [indent, 2, 0, 2],
        })
        return
      }

      if (block.type === 'table' && block.table?.length) {
        const rows = block.table.map(row => [...row])
        const columnCount = Math.max(1, rows[0]?.length ?? 1)
        const body = rows.map((row, rowIndex) => {
          const normalized = [...row]
          while (normalized.length < columnCount) normalized.push('')
          return normalized.map((cell) => ({
            text: stripInlineMarkdownForPdf(cell),
            style: rowIndex === 0 ? 'tableHeader' : 'tableCell',
          }))
        })

        content.push({
          table: {
            headerRows: 1,
            widths: new Array(columnCount).fill('*'),
            body,
          },
          layout: {
            hLineColor: () => '#dbe4ee',
            vLineColor: () => '#dbe4ee',
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            paddingTop: () => 6,
            paddingBottom: () => 6,
            paddingLeft: () => 8,
            paddingRight: () => 8,
          },
          margin: [0, 8, 0, 8],
        })
        return
      }

      if (block.type === 'divider') {
        content.push({
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' },
          ],
          margin: [0, 10, 0, 10],
        })
        return
      }

      content.push({
        text: stripInlineMarkdownForPdf(block.text),
        style: 'paragraph',
      })
    })

    const docDefinition = {
      info: { title },
      pageSize: 'A4',
      pageMargins: [44, 40, 44, 48],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10.5,
        lineHeight: 1.42,
        color: '#0f172a',
      },
      content,
      styles: {
        docTitle: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 2],
          color: '#0f172a',
        },
        docMeta: {
          fontSize: 8.5,
          color: '#64748b',
        },
        h1: {
          fontSize: 15,
          bold: true,
          margin: [0, 12, 0, 4],
        },
        h2: {
          fontSize: 13.5,
          bold: true,
          margin: [0, 10, 0, 4],
        },
        h3: {
          fontSize: 12,
          bold: true,
          margin: [0, 8, 0, 4],
        },
        paragraph: {
          margin: [0, 3, 0, 3],
        },
        listMarker: {
          fontSize: 10,
          color: '#334155',
          margin: [0, 1, 0, 0],
        },
        tableHeader: {
          fillColor: '#f8fafc',
          bold: true,
          color: '#1e293b',
        },
        tableCell: {
          color: '#0f172a',
        },
      },
    }

    const filename = `${createDownloadFilename(title)}.pdf`
    pdfMake.createPdf(docDefinition).download(filename)
  } catch (error) {
    console.error('Failed to export PDF:', error)
    window.alert('Unable to export PDF right now. Please try again.')
  }
}

// Import markdown
const showImportModal = ref(false)
const importTab = ref<'file' | 'paste'>('file')
const importPasteContent = ref('')
const importFileInput = ref<HTMLInputElement | null>(null)

const openImportModal = () => {
  importTab.value = 'file'
  importPasteContent.value = ''
  showImportModal.value = true
}

const handleImportFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    applyImportedMarkdown(text)
    input.value = ''
  }
  reader.readAsText(file)
}

const handleImportPaste = () => {
  if (!importPasteContent.value.trim()) return
  applyImportedMarkdown(importPasteContent.value)
}

const applyImportedMarkdown = (markdown: string) => {
  // Check if the markdown starts with a heading — use it as title if current is untitled
  const lines = markdown.split('\n')
  const firstLine = lines[0]?.trim()
  if (firstLine?.startsWith('# ') && (!editedTitle.value || editedTitle.value === 'Untitled document')) {
    editedTitle.value = firstLine.slice(2).trim()
    markdown = lines.slice(1).join('\n').replace(/^\n+/, '')
  }

  blocks.value = parseMarkdownToBlocks(markdown)
  showImportModal.value = false
  importPasteContent.value = ''
  scheduleSave()
  nextTick(() => autoResizeAllTextareas())
}

const saveVersion = async () => {
  if (!documentData.value) return
  try {
    await $fetch(`/api/documents/${documentData.value.id}/versions`, {
      method: 'POST',
      body: {
        label: versionLabel.value.trim() || null,
        notes: versionNotes.value.trim() || null,
        type: versionType.value,
        userId: currentUserId.value,
        title: editedTitle.value,
        content: serializedMarkdown.value,
      },
    })
    versionLabel.value = ''
    versionNotes.value = ''
    versionType.value = 'minor'
    showVersionModal.value = false
    fetchVersions()
    emit('updated')
  } catch (e) {
    console.error('Failed to save version:', e)
  }
}

const restoreVersion = async (version: DocumentVersion) => {
  if (!documentData.value || !canEdit.value) return
  const confirmed = window.confirm('Restore this version? This will replace the current content.')
  if (!confirmed) return
  editedTitle.value = version.title
  blocks.value = parseMarkdownToBlocks(version.content)
  await nextTick()
  await saveDocument()
}

const setBlockRef = (id: string) => (el: HTMLTextAreaElement | HTMLInputElement | null) => {
  if (el) {
    blockRefs.value[id] = el
  } else {
    delete blockRefs.value[id]
  }
}

const setTableRef = (key: string) => (el: HTMLInputElement | null) => {
  if (el) {
    tableRefs.value[key] = el
  } else {
    delete tableRefs.value[key]
  }
}

const focusBlock = (index: number, position: 'start' | 'end' = 'start') => {
  const block = blocks.value[index]
  if (!block) return
  if (block.type === 'table') {
    focusTableCell(block.id, 0, 0)
    return
  }
  const el = blockRefs.value[block.id]
  if (!el) return
  el.focus()
  const length = el.value?.length ?? 0
  const pos = position === 'end' ? length : 0
  el.setSelectionRange(pos, pos)
}

const focusTableCell = (blockId: string, row: number, col: number) => {
  const key = `${blockId}-${row}-${col}`
  const el = tableRefs.value[key]
  el?.focus()
  el?.setSelectionRange(el.value.length, el.value.length)
}

const insertBlockAfter = (index: number, block: Block) => {
  blocks.value.splice(index + 1, 0, block)
  nextTick(() => focusBlock(index + 1))
}

const insertBlock = (type: BlockType, index?: number) => {
  const newBlock = createBlock(type, '')
  if (index === undefined) {
    blocks.value.push(newBlock)
    nextTick(() => focusBlock(blocks.value.length - 1))
    return
  }
  insertBlockAfter(index, newBlock)
}

const handleBlockInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  if (!target) return
  target.style.height = 'auto'
  target.style.height = `${target.scrollHeight}px`
}

// Auto-resize all textareas to fit their content
const autoResizeAllTextareas = () => {
  nextTick(() => {
    for (const el of Object.values(blockRefs.value)) {
      if (el && el.tagName === 'TEXTAREA') {
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }
    }
  })
}

const handleBlockKeydown = (event: KeyboardEvent, block: Block, index: number) => {
  if (!canEdit.value) return
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const start = target.selectionStart ?? 0
  const end = target.selectionEnd ?? 0
  const atStart = start === 0 && end === 0
  const atEnd = start === target.value.length && end === target.value.length

  // Slash command menu handling
  if (slashMenuBlockIndex.value === index) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const newIndex = (slashMenuSelectedIndex.value + 1) % slashMenuOptions.length
      slashMenuSelectedIndex.value = newIndex
      scrollSlashMenuOptionIntoView(newIndex)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const newIndex = (slashMenuSelectedIndex.value - 1 + slashMenuOptions.length) % slashMenuOptions.length
      slashMenuSelectedIndex.value = newIndex
      scrollSlashMenuOptionIntoView(newIndex)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      selectSlashOption(slashMenuSelectedIndex.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSlashMenu()
      return
    }
    // Close menu if user types something other than navigation
    if (event.key !== '/' && event.key.length === 1) {
      closeSlashMenu()
    }
  }

  // Open slash menu when "/" is typed at the start of an empty paragraph block
  if (event.key === '/' && block.type === 'paragraph' && block.text === '' && atStart) {
    // Let the "/" be typed, then open menu
    nextTick(() => {
      openSlashMenu(index)
    })
    return
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
    if (event.key === '1') {
      event.preventDefault()
      setBlockType(index, 'heading', 1)
      return
    }
    if (event.key === '2') {
      event.preventDefault()
      setBlockType(index, 'heading', 2)
      return
    }
    if (event.key === '3') {
      event.preventDefault()
      setBlockType(index, 'heading', 3)
      return
    }
  }

  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    moveBlock(index, event.key === 'ArrowUp' ? -1 : 1)
    return
  }

  if (event.key === 'Backspace' && atStart && block.text.trim() === '') {
    event.preventDefault()
    if (blocks.value.length > 1) {
      blocks.value.splice(index, 1)
      nextTick(() => focusBlock(Math.max(0, index - 1), 'end'))
    } else {
      blocks.value[0] = createBlock('paragraph', '')
      nextTick(() => focusBlock(0))
    }
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()

    if (block.type === 'list-item') {
      if (!block.text.trim()) {
        blocks.value[index] = createBlock('paragraph', '')
        nextTick(() => focusBlock(index))
        return
      }
      const left = block.text.slice(0, start)
      const right = block.text.slice(end)
      block.text = left
      const nextItem = createBlock('list-item', right)
      nextItem.indent = block.indent ?? 0
      nextItem.listStyle = block.listStyle
      insertBlockAfter(index, nextItem)
      return
    }

    const left = block.text.slice(0, start)
    const right = block.text.slice(end)
    block.text = left

    const nextType = block.type === 'heading' ? 'paragraph' : block.type
    insertBlockAfter(index, createBlock(nextType, right))
    return
  }

  if (event.key === 'Backspace' && atStart) {
    if (block.type === 'list-item' && block.indent && block.indent > 0) {
      event.preventDefault()
      block.indent -= 1
      return
    }

    if (index > 0) {
      event.preventDefault()
      const prev = blocks.value[index - 1]
      if (prev.type !== 'table' && prev.type !== 'divider') {
        prev.text = `${prev.text}${block.text}`
        blocks.value.splice(index, 1)
        nextTick(() => focusBlock(index - 1, 'end'))
      } else {
        focusBlock(index - 1, 'end')
      }
    }
  }

  if (event.key === 'Tab' && block.type === 'list-item') {
    event.preventDefault()
    if (event.shiftKey) {
      block.indent = Math.max(0, (block.indent ?? 0) - 1)
    } else {
      block.indent = Math.min(6, (block.indent ?? 0) + 1)
    }
  }

  if (event.key === 'ArrowUp' && atStart) {
    event.preventDefault()
    if (index > 0) focusBlock(index - 1, 'end')
  }

  if (event.key === 'ArrowDown' && atEnd) {
    event.preventDefault()
    if (index < blocks.value.length - 1) focusBlock(index + 1, 'start')
  }
}

const handleTableKeydown = (
  event: KeyboardEvent,
  block: Block,
  blockIndex: number,
  rowIndex: number,
  colIndex: number
) => {
  if (!canEdit.value) return
  if (!block.table) return
  const rows = block.table.length
  const cols = block.table[rowIndex]?.length ?? 0
  const cellValue = block.table[rowIndex]?.[colIndex] ?? ''

  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    moveBlock(blockIndex, event.key === 'ArrowUp' ? -1 : 1)
    return
  }

  if (event.key === 'Backspace') {
    const isTableEmpty = block.table.every(row => row.every(cell => !cell.trim()))
    if (!cellValue.trim() && isTableEmpty) {
      event.preventDefault()
      if (blocks.value.length > 1) {
        blocks.value.splice(blockIndex, 1)
        nextTick(() => focusBlock(Math.max(0, blockIndex - 1), 'end'))
      } else {
        blocks.value[0] = createBlock('paragraph', '')
        nextTick(() => focusBlock(0))
      }
      return
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    const newRow = new Array(cols).fill('')
    block.table.splice(rowIndex + 1, 0, newRow)
    nextTick(() => focusTableCell(block.id, rowIndex + 1, colIndex))
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    if (event.shiftKey) {
      if (colIndex > 0) return focusTableCell(block.id, rowIndex, colIndex - 1)
      if (rowIndex > 0) return focusTableCell(block.id, rowIndex - 1, cols - 1)
      if (blockIndex > 0) return focusBlock(blockIndex - 1, 'end')
    } else {
      if (colIndex < cols - 1) return focusTableCell(block.id, rowIndex, colIndex + 1)
      if (rowIndex < rows - 1) return focusTableCell(block.id, rowIndex + 1, 0)
      insertBlockAfter(blockIndex, createBlock('paragraph', ''))
    }
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (rowIndex > 0) return focusTableCell(block.id, rowIndex - 1, colIndex)
    if (blockIndex > 0) focusBlock(blockIndex - 1, 'end')
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (rowIndex < rows - 1) return focusTableCell(block.id, rowIndex + 1, colIndex)
    if (blockIndex < blocks.value.length - 1) focusBlock(blockIndex + 1, 'start')
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (colIndex > 0) return focusTableCell(block.id, rowIndex, colIndex - 1)
    if (rowIndex > 0) return focusTableCell(block.id, rowIndex - 1, cols - 1)
    if (blockIndex > 0) focusBlock(blockIndex - 1, 'end')
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    if (colIndex < cols - 1) return focusTableCell(block.id, rowIndex, colIndex + 1)
    if (rowIndex < rows - 1) return focusTableCell(block.id, rowIndex + 1, 0)
    if (blockIndex < blocks.value.length - 1) focusBlock(blockIndex + 1, 'start')
  }
}

const addTableRow = (block: Block) => {
  if (!block.table) return
  const cols = block.table[0]?.length ?? 1
  block.table.push(new Array(cols).fill(''))
}

const addTableColumn = (block: Block) => {
  if (!block.table) return
  block.table.forEach((row) => row.push(''))
}

const moveBlock = (index: number, direction: -1 | 1) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= blocks.value.length) return
  const updated = [...blocks.value]
  const temp = updated[index]
  updated[index] = updated[targetIndex]
  updated[targetIndex] = temp
  blocks.value = updated
  nextTick(() => focusBlock(targetIndex, 'start'))
}

// Drag handlers for block reordering
const handleBlockDragStart = (e: DragEvent, index: number) => {
  draggedBlockIndex.value = index
  isDragging.value = true
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

const handleContainerDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (draggedBlockIndex.value === null || !blocksContainerRef.value) return
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

  const blockEls = blocksContainerRef.value.querySelectorAll<HTMLElement>('[data-block-index]')
  if (!blockEls.length) return
  const mouseY = e.clientY

  // Find insertion index based on cursor position relative to block midpoints
  // Cursor above all blocks → insert at 0, below all → insert at end
  let insertAt = 0
  for (let i = 0; i < blockEls.length; i++) {
    const rect = blockEls[i].getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (mouseY > midY) {
      insertAt = i + 1
    }
  }

  // Skip no-op positions (dropping at same place)
  if (insertAt === draggedBlockIndex.value || insertAt === draggedBlockIndex.value + 1) {
    dropTargetIndex.value = null
    return
  }

  dropTargetIndex.value = insertAt

  // Calculate indicator line position relative to blocks container
  const containerRect = blocksContainerRef.value.getBoundingClientRect()
  if (insertAt === 0) {
    const firstBlock = blockEls[0]
    if (firstBlock) {
      dropIndicatorTop.value = firstBlock.getBoundingClientRect().top - containerRect.top - 2
    }
  } else if (insertAt >= blockEls.length) {
    const lastBlock = blockEls[blockEls.length - 1]
    if (lastBlock) {
      dropIndicatorTop.value = lastBlock.getBoundingClientRect().bottom - containerRect.top + 2
    }
  } else {
    const prevBlock = blockEls[insertAt - 1]
    const nextBlock = blockEls[insertAt]
    if (prevBlock && nextBlock) {
      const prevBottom = prevBlock.getBoundingClientRect().bottom
      const nextTop = nextBlock.getBoundingClientRect().top
      dropIndicatorTop.value = (prevBottom + nextTop) / 2 - containerRect.top
    }
  }
}

const handleContainerDragLeave = () => {
  // Intentionally empty — indicator persists until dragend or successful drop
  // This allows dragging beyond the blocks area while keeping the indicator visible
}

const applyBlockDrop = () => {
  if (draggedBlockIndex.value === null || dropTargetIndex.value === null) return

  const fromIndex = draggedBlockIndex.value
  let toIndex = dropTargetIndex.value

  const updated = [...blocks.value]
  const [movedBlock] = updated.splice(fromIndex, 1)

  // Adjust target since we removed an item
  if (fromIndex < toIndex) toIndex--

  updated.splice(toIndex, 0, movedBlock)
  blocks.value = updated

  draggedBlockIndex.value = null
  dropTargetIndex.value = null
  isDragging.value = false
}

const handleContainerDrop = (e: DragEvent) => {
  e.preventDefault()
  applyBlockDrop()
}

const handleBlockDragEnd = () => {
  // Apply the drop wherever the cursor ended up — if we have a valid
  // drop target, commit the reorder even if the cursor left the container
  if (dropTargetIndex.value !== null) {
    applyBlockDrop()
  } else {
    draggedBlockIndex.value = null
    dropTargetIndex.value = null
    isDragging.value = false
  }
}

const formatRelativeTime = (dateString?: string | null) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const handleClose = () => {
  emit('close')
}

watch(() => props.open, (open) => {
  if (open && props.documentId) {
    isInitializing.value = true
    fetchDocument()
  } else if (!open) {
    documentData.value = null
    editedTitle.value = ''
    blocks.value = []
    versions.value = []
    isReadMode.value = false
    showVersions.value = false
    showVersionModal.value = false
  }
})

watch(() => props.documentId, () => {
  if (props.open) {
    isInitializing.value = true
    fetchDocument()
  }
})

watch([serializedMarkdown, editedTitle], () => {
  scheduleSave()
})

// Auto-resize textareas when switching to edit mode
watch(isReadMode, (readMode) => {
  if (!readMode) {
    autoResizeAllTextareas()
  }
})

// Close on escape and handle click outside
onMounted(() => {
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && props.open) {
      if (slashMenuBlockIndex.value !== null) {
        closeSlashMenu()
      } else {
        handleClose()
      }
    }
  }
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('[data-block-menu]')) {
      activeBlockMenuId.value = null
    }
    // Close slash menu when clicking outside
    if (!target?.closest('[data-slash-menu]') && slashMenuBlockIndex.value !== null) {
      closeSlashMenu()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', handleClick, true)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('click', handleClick, true)
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" @click="handleClose" />

        <div class="relative w-full max-w-6xl h-[90vh] mx-4 bg-white dark:bg-dm-panel rounded-2xl shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div class="flex items-start justify-between gap-4">
              <!-- Title and meta -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3">
                  <input
                    v-if="canEdit && !isReadMode"
                    v-model="editedTitle"
                    type="text"
                    class="flex-1 text-xl font-semibold text-slate-900 dark:text-zinc-100 dark:text-zinc-100 bg-transparent border-0 focus:outline-none focus:ring-0"
                    placeholder="Untitled document"
                  />
                  <h2 v-else class="text-xl font-semibold text-slate-900 dark:text-zinc-100 dark:text-zinc-100 truncate">{{ editedTitle || 'Untitled document' }}</h2>
                  <span
                    v-if="documentData?.isLocked"
                    class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex-shrink-0"
                  >
                    <Icon name="heroicons:lock-closed" class="w-3 h-3" />
                    Locked
                  </span>
                </div>
                <div class="mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
                  <span v-if="documentData?.createdBy">{{ documentData.createdBy.name }}</span>
                  <span v-if="documentData?.updatedAt" class="text-slate-300 dark:text-zinc-600">·</span>
                  <span v-if="documentData?.updatedAt">{{ formatRelativeTime(documentData.updatedAt) }}</span>
                  <Transition
                    enter-active-class="transition-opacity duration-200"
                    enter-from-class="opacity-0"
                    leave-active-class="transition-opacity duration-200"
                    leave-to-class="opacity-0"
                  >
                    <span v-if="isSaving" class="text-slate-300 dark:text-zinc-600">· Saving...</span>
                  </Transition>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1">
                <!-- Edit/Read toggle (hidden when locked) -->
                <div v-if="!documentData?.isLocked" class="flex items-center bg-slate-100 dark:bg-white/[0.08] rounded-lg p-0.5 mr-2">
                  <button
                    @click="isReadMode = false"
                    :class="[
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                      !isReadMode ? 'bg-white dark:bg-dm-card text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                    ]"
                  >
                    Edit
                  </button>
                  <button
                    @click="isReadMode = true"
                    :class="[
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                      isReadMode ? 'bg-white dark:bg-dm-card text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                    ]"
                  >
                    Read
                  </button>
                </div>

                <!-- Actions dropdown -->
                <div class="group/actions relative">
                  <button
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <Icon name="heroicons:ellipsis-horizontal" class="w-5 h-5" />
                  </button>
                  <div class="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06] shadow-xl z-30 py-1 opacity-0 invisible translate-y-[-4px] transition-all duration-150 group-hover/actions:opacity-100 group-hover/actions:visible group-hover/actions:translate-y-0">
                    <button
                      @click="showVersions = !showVersions"
                      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <Icon name="heroicons:clock" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      <span>Version history</span>
                    </button>
                    <button
                      @click="showVersionModal = true"
                      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <Icon name="heroicons:bookmark" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      <span>Save version</span>
                    </button>
                    <div v-if="documentData" class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                    <button
                      v-if="documentData"
                      @click="downloadAsMarkdown"
                      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <Icon name="heroicons:arrow-down-tray" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      <span>Download as Markdown</span>
                    </button>
                    <button
                      v-if="documentData"
                      @click="exportToPdf"
                      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <Icon name="heroicons:printer" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      <span>Export to PDF</span>
                    </button>
                    <button
                      v-if="canEdit && !isReadMode"
                      @click="openImportModal"
                      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <Icon name="heroicons:arrow-up-tray" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      <span>Import Markdown</span>
                    </button>
                    <template v-if="documentData && isOwner">
                      <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                      <button
                        @click="toggleLock"
                        class="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Icon :name="documentData?.isLocked ? 'heroicons:lock-open' : 'heroicons:lock-closed'" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                        <span>{{ documentData?.isLocked ? 'Unlock document' : 'Lock document' }}</span>
                      </button>
                    </template>
                    <template v-if="documentData">
                      <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                      <button
                        @click="deleteDocument"
                        class="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Icon name="heroicons:trash" class="w-4 h-4" />
                        <span>Delete document</span>
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Close -->
                <button
                  @click="handleClose"
                  class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors ml-1"
                >
                  <Icon name="heroicons:x-mark" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden flex">
            <div
              ref="dragAreaRef"
              class="flex-1 overflow-y-auto px-8 py-6"
              @dragover="handleContainerDragOver"
              @dragleave="handleContainerDragLeave"
              @drop="handleContainerDrop"
            >
              <div v-if="isLoading" class="space-y-3">
                <div v-for="i in 5" :key="i" class="h-6 rounded bg-slate-50 dark:bg-white/[0.04] animate-pulse" />
              </div>

              <!-- Read Mode -->
              <div v-else-if="isReadMode" class="max-w-4xl mx-auto">
                <div class="space-y-4">
                  <template v-for="(block, index) in blocks" :key="block.id">
                    <!-- Heading -->
                    <h1
                      v-if="block.type === 'heading'"
                      :class="[
                        'text-slate-900 dark:text-zinc-100',
                        block.level === 1 ? 'text-2xl font-bold mt-6 first:mt-0' : '',
                        block.level === 2 ? 'text-xl font-semibold mt-5 first:mt-0' : '',
                        block.level === 3 ? 'text-lg font-medium mt-4 first:mt-0' : '',
                      ]"
                      v-html="renderInline(block.text)"
                    />

                    <!-- List item -->
                    <div
                      v-else-if="block.type === 'list-item'"
                      class="flex items-start gap-2 text-[15px] leading-relaxed text-slate-700 dark:text-zinc-300"
                      :style="{ paddingLeft: `${(block.indent ?? 0) * 24}px` }"
                    >
                      <span v-if="block.checked !== undefined" class="select-none w-4 text-center flex-shrink-0 mt-0.5">
                        <Icon v-if="block.checked" name="heroicons:check-circle-solid" class="w-4 h-4 text-emerald-500" />
                        <Icon v-else name="heroicons:stop" class="w-4 h-4 text-slate-300 dark:text-zinc-600" />
                      </span>
                      <span v-else class="text-slate-400 dark:text-zinc-600 select-none w-4 text-center flex-shrink-0">
                        {{ block.listStyle === 'number' ? `${getNumberedListValue(index)}.` : '•' }}
                      </span>
                      <span v-html="renderInline(block.text)" />
                    </div>

                    <!-- Table -->
                    <div v-else-if="block.type === 'table'" class="overflow-x-auto my-4">
                      <table class="w-full text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg overflow-hidden">
                        <thead class="bg-slate-50 dark:bg-white/[0.04]">
                          <tr>
                            <th v-for="(cell, colIndex) in block.table?.[0]" :key="colIndex" class="px-3 py-2.5 text-left font-medium text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-white/[0.06]" v-html="renderInline(cell)" />
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(row, rowIndex) in block.table?.slice(1)" :key="rowIndex" class="border-t border-slate-100 dark:border-white/[0.04]">
                            <td v-for="(cell, colIndex) in row" :key="colIndex" class="px-3 py-2.5 text-slate-700 dark:text-zinc-300" v-html="renderInline(cell)" />
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- Divider -->
                    <hr v-else-if="block.type === 'divider'" class="border-slate-200 dark:border-white/[0.06] my-6" />

                    <!-- Paragraph -->
                    <p v-else class="text-[15px] leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap" v-html="renderInline(block.text)" />
                  </template>
                </div>
              </div>

              <!-- Edit Mode -->
              <div v-else class="max-w-4xl mx-auto">
                <!-- Locked warning -->
                <div v-if="!canEdit" class="mb-6 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm border border-amber-100 dark:border-amber-500/20 flex items-center gap-2">
                  <Icon name="heroicons:lock-closed" class="w-4 h-4" />
                  This document is locked. Only the creator can edit it.
                </div>

                <!-- Blocks -->
                <div
                  ref="blocksContainerRef"
                  class="relative space-y-1"
                >
                  <!-- Drop indicator line -->
                  <div
                    v-show="isDragging && dropTargetIndex !== null"
                    class="absolute left-0 right-0 z-10 pointer-events-none"
                    :class="dropTargetIndex !== null ? 'transition-[top] duration-150 ease-out' : ''"
                    :style="{ top: dropIndicatorTop + 'px' }"
                  >
                    <div class="h-0.5 bg-blue-500 rounded-full relative">
                      <div class="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500" />
                      <div class="absolute -right-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  </div>

                  <div
                    v-for="(block, index) in blocks"
                    :key="block.id"
                    :data-block-index="index"
                    :class="[
                      'group relative transition-all duration-200',
                      draggedBlockIndex === index ? 'opacity-25 scale-[0.98]' : '',
                    ]"
                  >
                    <!-- Block controls (left side, on hover) -->
                    <div
                      v-if="canEdit"
                      class="absolute -left-14 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <button
                        data-block-menu
                        @click.stop="toggleBlockMenu(block.id)"
                        class="w-6 h-6 flex items-center justify-center rounded text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:hover:bg-white/[0.06] transition-colors"
                        title="Change block type"
                      >
                        <Icon name="heroicons:squares-plus" class="w-4 h-4" />
                      </button>
                      <button
                        draggable="true"
                        @dragstart="handleBlockDragStart($event, index)"
                        @dragend="handleBlockDragEnd"
                        class="w-6 h-6 flex items-center justify-center rounded text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:hover:bg-white/[0.06] transition-colors cursor-grab active:cursor-grabbing"
                        title="Drag to reorder (or Alt+Arrow)"
                      >
                        <Icon name="heroicons:bars-2" class="w-4 h-4" />
                      </button>
                    </div>

                    <!-- Block type menu -->
                    <div
                      v-if="activeBlockMenuId === block.id"
                      data-block-menu
                      class="absolute -left-10 top-8 z-20 w-48 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card shadow-xl py-1"
                    >
                      <button
                        v-for="option in blockTypeOptions"
                        :key="option.label"
                        class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-600 dark:text-zinc-400 transition-colors"
                        @click.stop="setBlockType(index, option.type, option.level)"
                      >
                        <span class="w-6 h-6 rounded bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center text-xs font-medium text-slate-500 dark:text-zinc-400">
                          {{ option.label.charAt(0) }}
                        </span>
                        <span>{{ option.label }}</span>
                        <Icon v-if="option.type === block.type && (!option.level || option.level === block.level)" name="heroicons:check" class="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-auto" />
                      </button>
                      <div v-if="block.type === 'list-item'" class="border-t border-slate-100 dark:border-white/[0.04] mt-1 pt-1 px-2 pb-1 flex gap-1">
                        <button
                          :class="[
                            'flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors',
                            block.listStyle === 'bullet' ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200' : 'text-slate-500 hover:bg-slate-50'
                          ]"
                          @click.stop="block.listStyle = 'bullet'"
                        >
                          • Bullet
                        </button>
                        <button
                          :class="[
                            'flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors',
                            block.listStyle === 'number' ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200' : 'text-slate-500 hover:bg-slate-50'
                          ]"
                          @click.stop="block.listStyle = 'number'"
                        >
                          1. Number
                        </button>
                      </div>
                    </div>

                    <!-- Block content -->
                    <div class="relative">
                      <!-- Heading -->
                      <input
                        v-if="block.type === 'heading'"
                        v-model="block.text"
                        :ref="setBlockRef(block.id)"
                        type="text"
                        :readonly="!canEdit"
                        :class="[
                          'w-full bg-transparent border-0 focus:outline-none focus:ring-0 py-1',
                          block.level === 1 ? 'text-2xl font-bold text-slate-900 dark:text-zinc-100' : '',
                          block.level === 2 ? 'text-xl font-semibold text-slate-900 dark:text-zinc-100' : '',
                          block.level === 3 ? 'text-lg font-medium text-slate-800 dark:text-zinc-200' : '',
                        ]"
                        placeholder="Heading"
                        @keydown="handleBlockKeydown($event, block, index)"
                      />

                      <!-- List item -->
                      <div v-else-if="block.type === 'list-item'" class="flex items-start gap-2 py-0.5" :style="{ paddingLeft: `${(block.indent ?? 0) * 24}px` }">
                        <span class="mt-1 text-slate-400 dark:text-zinc-600 select-none w-4 text-center flex-shrink-0">
                          {{ block.listStyle === 'number' ? `${getNumberedListValue(index)}.` : '•' }}
                        </span>
                        <textarea
                          v-model="block.text"
                          :ref="setBlockRef(block.id)"
                          rows="1"
                          :readonly="!canEdit"
                          class="flex-1 text-[15px] leading-relaxed text-slate-700 dark:text-zinc-300 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none py-0"
                          placeholder="List item"
                          @input="handleBlockInput"
                          @keydown="handleBlockKeydown($event, block, index)"
                        />
                      </div>

                      <!-- Table -->
                      <div v-else-if="block.type === 'table'" class="py-2">
                        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/[0.06]">
                          <table class="w-full text-sm">
                            <thead class="bg-slate-50 dark:bg-white/[0.04]">
                              <tr>
                                <th
                                  v-for="(cell, colIndex) in block.table?.[0]"
                                  :key="colIndex"
                                  class="px-3 py-2 text-left font-medium text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-white/[0.06]"
                                >
                                  <input
                                    v-model="block.table![0][colIndex]"
                                    :ref="setTableRef(`${block.id}-0-${colIndex}`)"
                                    type="text"
                                    :readonly="!canEdit"
                                    class="w-full bg-transparent border-0 focus:outline-none focus:ring-0 font-medium"
                                    placeholder="Header"
                                    @keydown="handleTableKeydown($event, block, index, 0, colIndex)"
                                  />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(row, rowIndex) in block.table?.slice(1)" :key="rowIndex" class="border-t border-slate-100 dark:border-white/[0.04]">
                                <td v-for="(cell, colIndex) in row" :key="colIndex" class="px-3 py-2">
                                  <input
                                    v-model="block.table![rowIndex + 1][colIndex]"
                                    :ref="setTableRef(`${block.id}-${rowIndex + 1}-${colIndex}`)"
                                    type="text"
                                    :readonly="!canEdit"
                                    class="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-700 dark:text-zinc-300"
                                    placeholder="Cell"
                                    @keydown="handleTableKeydown($event, block, index, rowIndex + 1, colIndex)"
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div v-if="canEdit" class="flex items-center gap-2 mt-2">
                          <button
                            class="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                            @click="addTableRow(block)"
                          >
                            + Add row
                          </button>
                          <span class="text-slate-200 dark:text-zinc-700">|</span>
                          <button
                            class="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                            @click="addTableColumn(block)"
                          >
                            + Add column
                          </button>
                        </div>
                      </div>

                      <!-- Divider -->
                      <div v-else-if="block.type === 'divider'" class="py-4">
                        <hr class="border-slate-200 dark:border-white/[0.06]" />
                      </div>

                      <!-- Paragraph (default) -->
                      <div v-else class="relative">
                        <textarea
                          v-model="block.text"
                          :ref="setBlockRef(block.id)"
                          rows="1"
                          :readonly="!canEdit"
                          class="w-full text-[15px] leading-relaxed text-slate-700 dark:text-zinc-300 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none py-1"
                          placeholder="Type something, or press '/' for commands..."
                          @input="handleBlockInput"
                          @keydown="handleBlockKeydown($event, block, index)"
                        />

                        <!-- Slash command menu -->
                        <Transition
                          enter-active-class="transition-all duration-150 ease-out"
                          enter-from-class="opacity-0 -translate-y-1"
                          enter-to-class="opacity-100 translate-y-0"
                          leave-active-class="transition-all duration-100 ease-in"
                          leave-from-class="opacity-100 translate-y-0"
                          leave-to-class="opacity-0 -translate-y-1"
                        >
                          <div
                            v-if="slashMenuBlockIndex === index"
                            data-slash-menu
                            class="absolute left-0 top-full mt-1 z-30 w-72 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card shadow-xl overflow-hidden"
                          >
                            <div class="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
                              <span class="text-xs font-medium text-slate-400 dark:text-zinc-500">Block types</span>
                            </div>
                            <div class="py-1 max-h-64 overflow-y-auto">
                              <button
                                v-for="(option, optionIndex) in slashMenuOptions"
                                :key="option.label"
                                :ref="setSlashMenuOptionRef(optionIndex)"
                                :class="[
                                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                                  slashMenuSelectedIndex === optionIndex ? 'bg-slate-100 dark:bg-white/[0.08]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                                ]"
                                @click="selectSlashOption(optionIndex)"
                                @mouseenter="slashMenuSelectedIndex = optionIndex"
                              >
                                <span class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center text-sm font-medium text-slate-500 dark:text-zinc-400 flex-shrink-0">
                                  {{ option.icon }}
                                </span>
                                <div class="min-w-0">
                                  <div class="text-sm font-medium text-slate-700 dark:text-zinc-200">{{ option.label }}</div>
                                  <div class="text-xs text-slate-400 dark:text-zinc-500 truncate">{{ option.description }}</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        </Transition>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Add new block (bottom) -->
                <div v-if="canEdit" class="mt-8 pt-4 border-t border-dashed border-slate-200 dark:border-white/[0.06]">
                  <button
                    @click="insertBlock('paragraph')"
                    class="flex items-center gap-2 text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    <Icon name="heroicons:plus" class="w-4 h-4" />
                    Add a new block
                  </button>
                </div>
              </div>
            </div>

            <!-- Versions Drawer -->
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="translate-x-full opacity-0"
              enter-to-class="translate-x-0 opacity-100"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="translate-x-0 opacity-100"
              leave-to-class="translate-x-full opacity-0"
            >
              <div
                v-if="showVersions"
                class="w-80 border-l border-slate-100 dark:border-white/[0.06] bg-slate-50/80 dark:bg-dm-card/80 backdrop-blur-sm flex flex-col"
              >
                <div class="px-4 py-3 border-b border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                  <h3 class="text-sm font-medium text-slate-800 dark:text-zinc-200">Version History</h3>
                  <button
                    class="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    @click="showVersions = false"
                  >
                    <Icon name="heroicons:x-mark" class="w-4 h-4" />
                  </button>
                </div>

                <div class="flex-1 overflow-y-auto p-4">
                  <div v-if="versions.length === 0" class="text-center py-8">
                    <Icon name="heroicons:clock" class="w-8 h-8 text-slate-200 dark:text-zinc-700 mx-auto mb-2" />
                    <p class="text-sm text-slate-400 dark:text-zinc-500">No saved versions yet</p>
                    <p class="text-xs text-slate-300 dark:text-zinc-600 mt-1">Click the bookmark icon to save a version</p>
                  </div>

                  <div v-else class="space-y-3">
                    <button
                      v-for="version in versions"
                      :key="version.id"
                      class="w-full text-left p-3 rounded-xl bg-white dark:bg-dm-surface border border-slate-100 dark:border-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.08] hover:shadow-sm transition-all"
                      @click="canEdit && restoreVersion(version)"
                    >
                      <div class="flex items-center gap-2">
                        <span
                          :class="[
                            'w-2 h-2 rounded-full flex-shrink-0',
                            version.type === 'major' ? 'bg-rose-400' : 'bg-slate-300 dark:bg-zinc-600'
                          ]"
                        />
                        <span class="text-sm font-medium text-slate-700 dark:text-zinc-300 truncate">
                          {{ version.label || (version.type === 'major' ? 'Major version' : 'Minor update') }}
                        </span>
                      </div>
                      <div class="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                        {{ formatRelativeTime(version.createdAt) }}
                        <span v-if="version.createdBy"> · {{ version.createdBy.name }}</span>
                      </div>
                      <p v-if="version.notes" class="mt-2 text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{{ version.notes }}</p>
                      <span v-if="canEdit" class="mt-2 inline-block text-xs text-blue-600">Click to restore</span>
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Save Version Modal -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="showVersionModal" class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
              <div class="bg-white dark:bg-dm-panel rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                  <h3 class="text-base font-semibold text-slate-800 dark:text-zinc-100">Save Version</h3>
                  <button
                    class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    @click="showVersionModal = false"
                  >
                    <Icon name="heroicons:x-mark" class="w-4 h-4" />
                  </button>
                </div>

                <div class="p-5 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Version name</label>
                    <input
                      v-model="versionLabel"
                      type="text"
                      class="w-full text-sm border border-slate-200 dark:border-white/[0.06] dark:bg-dm-surface dark:text-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 focus:border-slate-300 dark:focus:border-zinc-600 transition-all"
                      placeholder="e.g., Final draft, Review ready..."
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Notes <span class="font-normal text-slate-400 dark:text-zinc-500">(optional)</span></label>
                    <textarea
                      v-model="versionNotes"
                      rows="3"
                      class="w-full text-sm border border-slate-200 dark:border-white/[0.06] dark:bg-dm-surface dark:text-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 focus:border-slate-300 dark:focus:border-zinc-600 transition-all resize-none"
                      placeholder="What changed in this version?"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Version type</label>
                    <div class="flex gap-2">
                      <button
                        :class="[
                          'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                          versionType === 'minor'
                            ? 'bg-slate-100 dark:bg-white/[0.08] border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-zinc-200'
                            : 'border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        ]"
                        @click="versionType = 'minor'"
                      >
                        Minor update
                      </button>
                      <button
                        :class="[
                          'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                          versionType === 'major'
                            ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400'
                            : 'border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        ]"
                        @click="versionType = 'major'"
                      >
                        Major version
                      </button>
                    </div>
                  </div>
                </div>

                <div class="px-5 py-4 bg-slate-50 dark:bg-white/[0.04] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
                  <button
                    class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
                    @click="showVersionModal = false"
                  >
                    Cancel
                  </button>
                  <button
                    class="px-5 py-2 text-sm font-medium rounded-xl bg-slate-900 dark:bg-white/[0.1] text-white dark:text-zinc-200 hover:bg-slate-800 dark:hover:bg-white/[0.15] transition-colors"
                    @click="saveVersion"
                  >
                    Save Version
                  </button>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Import Markdown Modal -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="showImportModal" class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
              <div class="bg-white dark:bg-dm-panel rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                  <h3 class="text-base font-semibold text-slate-800 dark:text-zinc-100">Import Markdown</h3>
                  <button
                    class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    @click="showImportModal = false"
                  >
                    <Icon name="heroicons:x-mark" class="w-4 h-4" />
                  </button>
                </div>

                <div class="p-5 space-y-4">
                  <!-- Tab selector -->
                  <div class="flex items-center bg-slate-100 dark:bg-white/[0.08] rounded-lg p-0.5">
                    <button
                      @click="importTab = 'file'"
                      :class="[
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                        importTab === 'file' ? 'bg-white dark:bg-dm-card text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                      ]"
                    >
                      <Icon name="heroicons:document-arrow-up" class="w-3.5 h-3.5" />
                      From file
                    </button>
                    <button
                      @click="importTab = 'paste'"
                      :class="[
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                        importTab === 'paste' ? 'bg-white dark:bg-dm-card text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                      ]"
                    >
                      <Icon name="heroicons:clipboard-document" class="w-3.5 h-3.5" />
                      Paste text
                    </button>
                  </div>

                  <!-- File upload tab -->
                  <div v-if="importTab === 'file'">
                    <label
                      class="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <Icon name="heroicons:arrow-up-tray" class="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                      <span class="text-sm text-slate-500 dark:text-zinc-400">Choose a .md or .txt file</span>
                      <span class="text-xs text-slate-400 dark:text-zinc-500">or drag and drop</span>
                      <input
                        ref="importFileInput"
                        type="file"
                        accept=".md,.markdown,.txt,.text"
                        class="hidden"
                        @change="handleImportFile"
                      />
                    </label>
                    <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">This will replace the current document content.</p>
                  </div>

                  <!-- Paste tab -->
                  <div v-if="importTab === 'paste'">
                    <textarea
                      v-model="importPasteContent"
                      rows="10"
                      class="w-full text-sm border border-slate-200 dark:border-white/[0.06] dark:bg-dm-surface dark:text-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 focus:border-slate-300 dark:focus:border-zinc-600 transition-all resize-none font-mono"
                      placeholder="Paste your markdown content here..."
                    />
                    <p class="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">This will replace the current document content.</p>
                  </div>
                </div>

                <div v-if="importTab === 'paste'" class="px-5 py-4 bg-slate-50 dark:bg-white/[0.04] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
                  <button
                    class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
                    @click="showImportModal = false"
                  >
                    Cancel
                  </button>
                  <button
                    :disabled="!importPasteContent.trim()"
                    class="px-5 py-2 text-sm font-medium rounded-xl bg-slate-900 dark:bg-white/[0.1] text-white dark:text-zinc-200 hover:bg-slate-800 dark:hover:bg-white/[0.15] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="handleImportPaste"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
