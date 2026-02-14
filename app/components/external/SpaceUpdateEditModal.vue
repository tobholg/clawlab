<script setup lang="ts">
interface SpaceUpdate {
  id: string
  title: string
  summary: string
  wins: Array<{ text: string }>
  risks: Array<{ text: string }>
  status: 'DRAFT' | 'PUBLISHED' | 'DISCARDED'
  publishedAt: string | null
  createdAt: string
  generatedBy: { name: string }
}

interface Space {
  id: string
  slug: string
}

const props = defineProps<{
  open: boolean
  update: SpaceUpdate
  space: Space
}>()

const emit = defineEmits<{
  close: []
  saved: [update: SpaceUpdate]
}>()

const title = ref('')
const summary = ref('')
const wins = ref<Array<{ text: string }>>([])
const risks = ref<Array<{ text: string }>>([])
const saving = ref(false)
const error = ref<string | null>(null)

watch(() => [props.open, props.update], () => {
  if (props.open && props.update) {
    title.value = props.update.title
    summary.value = props.update.summary
    wins.value = (props.update.wins || []).map(w => ({ text: w.text }))
    risks.value = (props.update.risks || []).map(r => ({ text: r.text }))
    error.value = null
  }
}, { immediate: true })

const addWin = () => wins.value.push({ text: '' })
const removeWin = (index: number) => wins.value.splice(index, 1)
const addRisk = () => risks.value.push({ text: '' })
const removeRisk = (index: number) => risks.value.splice(index, 1)

const handleSubmit = async () => {
  if (!title.value.trim()) {
    error.value = 'Title is required'
    return
  }
  if (!summary.value.trim()) {
    error.value = 'Summary is required'
    return
  }

  saving.value = true
  error.value = null

  try {
    const result = await $fetch<SpaceUpdate>(`/api/s/${props.space.id}/${props.space.slug}/updates/${props.update.id}`, {
      method: 'PATCH',
      body: {
        action: 'edit',
        title: title.value.trim(),
        summary: summary.value.trim(),
        wins: wins.value.filter(w => w.text.trim()),
        risks: risks.value.filter(r => r.text.trim()),
      },
    })
    emit('saved', result)
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to save update'
  } finally {
    saving.value = false
  }
}

const handleClose = () => emit('close')

onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) {
      handleClose()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
          @click="handleClose"
        />

        <!-- Modal -->
        <div class="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 class="text-base font-medium text-slate-900 dark:text-zinc-100">Edit Update</h2>
            <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Modify the stakeholder update content
            </p>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-4 overflow-y-auto">
            <!-- Error -->
            <div v-if="error" class="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              {{ error }}
            </div>

            <!-- Title -->
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">Title</label>
              <input
                v-model="title"
                type="text"
                class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.1] dark:bg-white/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/[0.1] focus:border-slate-300 dark:focus:border-white/[0.15] dark:text-zinc-100 transition-all"
                autofocus
              />
            </div>

            <!-- Summary -->
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">Summary</label>
              <textarea
                v-model="summary"
                rows="4"
                class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.1] dark:bg-white/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/[0.1] focus:border-slate-300 dark:focus:border-white/[0.15] dark:text-zinc-100 transition-all resize-none"
              />
            </div>

            <!-- Wins -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-medium text-slate-500 dark:text-zinc-400">Wins</label>
                <button
                  type="button"
                  @click="addWin"
                  class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Add
                </button>
              </div>
              <div class="space-y-2">
                <div v-for="(win, i) in wins" :key="i" class="flex items-center gap-2">
                  <input
                    v-model="win.text"
                    type="text"
                    placeholder="Win..."
                    class="flex-1 px-3 py-1.5 text-sm border border-slate-200 dark:border-white/[0.1] dark:bg-white/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/[0.1] dark:text-zinc-100 transition-all"
                  />
                  <button
                    type="button"
                    @click="removeWin(i)"
                    class="p-1 rounded text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Icon name="heroicons:x-mark" class="w-4 h-4" />
                  </button>
                </div>
                <p v-if="wins.length === 0" class="text-xs text-slate-400 dark:text-zinc-500 italic">No wins added</p>
              </div>
            </div>

            <!-- Risks -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-medium text-slate-500 dark:text-zinc-400">Risks</label>
                <button
                  type="button"
                  @click="addRisk"
                  class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Add
                </button>
              </div>
              <div class="space-y-2">
                <div v-for="(risk, i) in risks" :key="i" class="flex items-center gap-2">
                  <input
                    v-model="risk.text"
                    type="text"
                    placeholder="Risk..."
                    class="flex-1 px-3 py-1.5 text-sm border border-slate-200 dark:border-white/[0.1] dark:bg-white/[0.04] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/[0.1] dark:text-zinc-100 transition-all"
                  />
                  <button
                    type="button"
                    @click="removeRisk(i)"
                    class="p-1 rounded text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Icon name="heroicons:x-mark" class="w-4 h-4" />
                  </button>
                </div>
                <p v-if="risks.length === 0" class="text-xs text-slate-400 dark:text-zinc-500 italic">No risks added</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm font-normal text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!title.trim() || !summary.trim() || saving"
                class="px-4 py-2 text-sm font-normal text-white bg-slate-900 dark:bg-white dark:text-zinc-900 rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.15s ease;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
}
</style>
