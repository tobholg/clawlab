<script setup lang="ts">
const emit = defineEmits<{
  close: []
}>()

const { createWorkspace, currentWorkspace } = useWorkspaces()

const name = ref('')
const description = ref('')
const submitting = ref(false)
const error = ref('')

const canSubmit = computed(() => name.value.trim().length > 0 && !submitting.value)

const handleSubmit = async () => {
  if (!canSubmit.value) return

  // Get organizationId from current workspace
  const organizationId = currentWorkspace.value?.organizationId
  if (!organizationId) {
    error.value = 'No organization found'
    return
  }

  submitting.value = true
  error.value = ''

  try {
    await createWorkspace({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      organizationId,
    })
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to create workspace'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="emit('close')">
      <div class="bg-white dark:bg-dm-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">Create workspace</h2>
          <button @click="emit('close')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Name</label>
            <input
              v-model="name"
              type="text"
              maxlength="100"
              placeholder="e.g. Engineering, Marketing"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] text-sm text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/50 focus:border-transparent"
              autofocus
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Description <span class="text-slate-400 dark:text-zinc-500">(optional)</span></label>
            <textarea
              v-model="description"
              rows="2"
              maxlength="500"
              placeholder="What is this workspace for?"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] text-sm text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/50 focus:border-transparent resize-none"
            />
          </div>

          <div v-if="error" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">
            {{ error }}
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="!canSubmit"
              class="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-white/[0.1] rounded-lg hover:bg-slate-800 dark:hover:bg-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ submitting ? 'Creating...' : 'Create workspace' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
