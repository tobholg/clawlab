export interface LightboxItem {
  url: string
  name: string
  mimeType: string
  attachmentId?: string
}

const state = reactive({
  isOpen: false,
  items: [] as LightboxItem[],
  currentIndex: 0,
})

const normalizeIndex = (index: number, length: number) => {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

const currentItem = computed<LightboxItem | null>(() => {
  if (!state.items.length) return null
  return state.items[state.currentIndex] ?? null
})

function open(item: LightboxItem) {
  openGallery([item], 0)
}

function openGallery(items: LightboxItem[], startIndex = 0) {
  if (!items.length) {
    close()
    return
  }

  state.items = [...items]
  state.currentIndex = normalizeIndex(startIndex, state.items.length)
  state.isOpen = true
}

function close() {
  state.isOpen = false
}

function next() {
  if (!state.items.length) return
  state.currentIndex = normalizeIndex(state.currentIndex + 1, state.items.length)
}

function prev() {
  if (!state.items.length) return
  state.currentIndex = normalizeIndex(state.currentIndex - 1, state.items.length)
}

export function useLightbox() {
  // Chunk 2: channel message attachment rendering should open this global lightbox.
  return {
    isOpen: toRef(state, 'isOpen'),
    items: toRef(state, 'items'),
    currentIndex: toRef(state, 'currentIndex'),
    currentItem,
    open,
    openGallery,
    close,
    next,
    prev,
  }
}
