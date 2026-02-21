<script setup lang="ts">
const props = defineProps<{
  open: boolean
  workspaceId: string
  channels?: { id: string; displayName: string }[]
}>()

const emit = defineEmits<{
  close: []
  created: [channel: any]
}>()

const router = useRouter()

const displayName = ref('')
const description = ref('')
const visibility = ref<'PUBLIC' | 'PRIVATE'>('PUBLIC')
const parentId = ref<string | null>(null)
const creating = ref(false)
const error = ref('')

watch(() => props.open, (open) => {
  if (open) {
    displayName.value = ''
    description.value = ''
    visibility.value = 'PUBLIC'
    parentId.value = null
    error.value = ''
  }
})

const canCreate = computed(() => displayName.value.trim().length > 0 && !creating.value)

const handleCreate = async () => {
  if (!canCreate.value) return
  creating.value = true
  error.value = ''

  try {
    const channel = await $fetch('/api/channels', {
      method: 'POST',
      body: {
        workspaceId: props.workspaceId,
        displayName: displayName.value.trim(),
        description: description.value.trim() || undefined,
        visibility: visibility.value,
        parentId: parentId.value || undefined,
      },
    })
    emit('created', channel)
    emit('close')
    router.push(`/workspace/channels/${channel.id}`)
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to create channel'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40" @click="emit('close')" />

        <!-- Panel -->
        <div class="relative bg-white dark:bg-dm-panel rounded-2xl shadow-xl w-full max-w-md mx-4 border border-slate-200 dark:border-white/[0.06]">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-5 pb-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">Create Channel</h2>
            <button
              @click="emit('close')"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 pb-5 space-y-4">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Channel name</label>
              <input
                v-model="displayName"
                type="text"
                maxlength="80"
                placeholder="e.g. design-team"
                class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30"
                @keydown.enter="handleCreate"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Description <span class="text-slate-400 dark:text-zinc-500 font-normal">(optional)</span></label>
              <textarea
                v-model="description"
                rows="2"
                maxlength="500"
                placeholder="What's this channel about?"
                class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30 resize-none"
              />
            </div>

            <!-- Visibility -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Visibility</label>
              <div class="flex gap-2">
                <button
                  v-for="opt in [
                    { value: 'PUBLIC', label: 'Public', icon: 'heroicons:hashtag', desc: 'Anyone in the workspace' },
                    { value: 'PRIVATE', label: 'Private', icon: 'heroicons:lock-closed', desc: 'Invite only' },
                  ]"
                  :key="opt.value"
                  @click="visibility = opt.value as any"
                  class="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors"
                  :class="visibility === opt.value
                    ? 'border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]'"
                >
                  <Icon :name="opt.icon" class="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <div>
                    <div class="text-sm font-medium text-slate-800 dark:text-zinc-200">{{ opt.label }}</div>
                    <div class="text-[11px] text-slate-400 dark:text-zinc-500">{{ opt.desc }}</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Parent channel (optional) -->
            <div v-if="channels?.length">
              <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Nest under <span class="text-slate-400 dark:text-zinc-500 font-normal">(optional)</span></label>
              <select
                v-model="parentId"
                class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-dm-card text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20"
              >
                <option :value="null">None (top-level)</option>
                <option v-for="ch in channels" :key="ch.id" :value="ch.id">{{ ch.displayName }}</option>
              </select>
            </div>

            <!-- Error -->
            <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-5 flex justify-end gap-2">
            <button
              @click="emit('close')"
              class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              :disabled="!canCreate"
              @click="handleCreate"
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-slate-900 dark:bg-white/[0.1] text-white dark:text-zinc-100 hover:bg-slate-800 dark:hover:bg-white/[0.15]"
            >
              {{ creating ? 'Creating...' : 'Create Channel' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}
</style>
