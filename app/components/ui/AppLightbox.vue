<script setup lang="ts">
const { isOpen, items, currentIndex, currentItem, close, next, prev } = useLightbox()
const pdfPreviewError = ref(false)

const isImage = (mimeType: string) => mimeType.startsWith('image/')
const isPdf = (mimeType: string) => mimeType === 'application/pdf'

const onKeydown = (event: KeyboardEvent) => {
  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prev()
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  }
}

watch(
  () => currentItem.value?.url,
  () => {
    pdfPreviewError.value = false
  }
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && currentItem"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
      @click="close"
    >
      <div class="absolute inset-x-0 top-0 border-b border-white/10 bg-black/40" @click.stop>
        <div class="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 text-white">
          <p class="truncate text-sm font-medium">{{ currentItem.name }}</p>

          <div class="flex items-center gap-2">
            <a
              :href="currentItem.url"
              :download="currentItem.name"
              class="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/20 px-2.5 py-1.5 text-xs text-white hover:bg-black/35 transition-colors"
            >
              <Icon name="heroicons:arrow-down-tray" class="h-3.5 w-3.5" />
              Download
            </a>

            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/20 text-white hover:bg-black/35 transition-colors"
              aria-label="Close preview"
              @click="close"
            >
              <Icon name="heroicons:x-mark" class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div class="absolute inset-0 flex items-center justify-center p-4 pb-16 pt-20">
        <div class="relative flex max-h-full w-full max-w-7xl items-center justify-center" @click.stop>
          <img
            v-if="isImage(currentItem.mimeType)"
            :src="currentItem.url"
            :alt="currentItem.name"
            class="max-h-[85vh] w-auto max-w-full object-contain"
          >

          <div v-else-if="isPdf(currentItem.mimeType)" class="w-full">
            <iframe
              :src="currentItem.url"
              :title="`PDF preview: ${currentItem.name}`"
              class="h-[85vh] w-full rounded-lg border border-white/10 bg-white dark:bg-dm-card"
              @error="pdfPreviewError = true"
            />

            <p class="mt-3 text-center text-sm text-zinc-200">
              {{ pdfPreviewError ? "Can't preview -" : "If preview doesn't load," }}
              <a :href="currentItem.url" :download="currentItem.name" class="underline hover:text-white transition-colors">
                Download
              </a>
            </p>
          </div>

          <div v-else class="w-full max-w-md rounded-xl border border-white/10 bg-black/30 p-6 text-center text-zinc-200 dark:bg-dm-card">
            <Icon name="heroicons:document" class="mx-auto h-10 w-10 text-zinc-400" />
            <p class="mt-3 text-sm">This file type cannot be previewed.</p>
            <a
              :href="currentItem.url"
              :download="currentItem.name"
              class="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/20 px-3 py-2 text-xs font-medium text-white hover:bg-black/35 transition-colors"
            >
              <Icon name="heroicons:arrow-down-tray" class="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </div>
      </div>

      <button
        v-if="items.length > 1"
        type="button"
        class="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white hover:bg-black/50 transition-colors"
        aria-label="Previous item"
        @click.stop="prev"
      >
        <Icon name="heroicons:chevron-left" class="h-5 w-5" />
      </button>

      <button
        v-if="items.length > 1"
        type="button"
        class="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white hover:bg-black/50 transition-colors"
        aria-label="Next item"
        @click.stop="next"
      >
        <Icon name="heroicons:chevron-right" class="h-5 w-5" />
      </button>

      <div
        v-if="items.length > 1"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-xs font-medium text-zinc-100"
      >
        {{ currentIndex + 1 }} / {{ items.length }}
      </div>
    </div>
  </Teleport>
</template>
