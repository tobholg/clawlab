<script setup lang="ts">
const emit = defineEmits<{
  select: [emoji: string]
  close: []
}>()

// Common reactions (quick access)
const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🚀', '👀']

// Emoji categories
const categories = [
  { name: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '🤯', '😱', '😨', '😰', '😢', '😭', '😤', '😠', '😡', '🤬'] },
  { name: 'Gestures', emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏'] },
  { name: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
  { name: 'Objects', emojis: ['🎉', '🎊', '🎁', '🏆', '🥇', '🎯', '🚀', '💡', '🔥', '⭐', '✨', '💫', '🌟', '💯', '✅', '❌', '⚠️', '📌', '📍', '🔔', '💬', '💭', '🗯️', '👁️', '👀'] },
]

const activeCategory = ref(0)

// Handle click outside
const pickerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
      emit('close')
    }
  }
  document.addEventListener('click', handleClickOutside, true)
  onUnmounted(() => document.removeEventListener('click', handleClickOutside, true))
})
</script>

<template>
  <div 
    ref="pickerRef"
    class="w-72 bg-white dark:bg-dm-card rounded-xl shadow-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden"
  >
    <!-- Quick access -->
    <div class="p-2 border-b border-slate-100 dark:border-white/[0.06]">
      <div class="flex gap-1">
        <button
          v-for="emoji in quickEmojis"
          :key="emoji"
          class="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
          @click="emit('select', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <!-- Category tabs -->
    <div class="flex border-b border-slate-100 dark:border-white/[0.06] px-2">
      <button
        v-for="(cat, index) in categories"
        :key="cat.name"
        :class="[
          'px-3 py-2 text-xs font-medium transition-colors',
          activeCategory === index
            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
        ]"
        @click="activeCategory = index"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- Emoji grid -->
    <div class="p-2 h-48 overflow-y-auto">
      <div class="grid grid-cols-8 gap-1">
        <button
          v-for="emoji in categories[activeCategory].emojis"
          :key="emoji"
          class="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
          @click="emit('select', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </div>
</template>
