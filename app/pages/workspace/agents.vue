<script setup lang="ts">
import { useAgentTerminals } from '~/composables/useAgentTerminals'

definePageMeta({
  layout: 'workspace',
  middleware: 'auth',
})

const { workspaceId } = useItems()
const { openLauncherForAgent } = useAgentTerminals()

const { data: membership, refresh: refreshMembership } = useFetch('/api/workspaces/membership', {
  query: computed(() => ({ workspaceId: workspaceId.value })),
  immediate: false,
})

const isAdmin = computed(() => {
  const role = membership.value?.role
  return role === 'OWNER' || role === 'ADMIN'
})

const isOrgAdmin = computed(() => membership.value?.isOrgAdmin === true)

const agents = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const showAddModal = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const newAgentName = ref('')
const newAgentProvider = ref('openclaw')

const showEditModal = ref(false)
const editing = ref(false)
const editError = ref<string | null>(null)
const editAgentId = ref<string | null>(null)
const editAgentName = ref('')
const editAgentProvider = ref('openclaw')

const confirmRemove = ref<string | null>(null)
const removing = ref<string | null>(null)
const regenerating = ref<string | null>(null)

const showApiKeyModal = ref(false)
const generatedAgentKey = ref<{ name: string; provider: string; apiKey: string } | null>(null)
const copiedKey = ref(false)

const providerOptions = [
  { value: 'openclaw', label: 'OpenClaw' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'codex', label: 'Codex' },
  { value: 'custom', label: 'Custom' },
]

const providerLabel = (provider: string | null | undefined) => {
  const found = providerOptions.find(option => option.value === (provider ?? '').toLowerCase())
  if (found) return found.label
  return 'Custom'
}

const formatLastActive = (value: string | null | undefined) => {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const fetchAgents = async () => {
  if (!workspaceId.value) return

  loading.value = true
  error.value = null

  try {
    agents.value = await $fetch(`/api/workspaces/${workspaceId.value}/agents`)
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load agents'
    agents.value = []
  } finally {
    loading.value = false
  }
}

const resetAddModal = () => {
  showAddModal.value = false
  creating.value = false
  createError.value = null
  newAgentName.value = ''
  newAgentProvider.value = 'openclaw'
}

const openAddModal = () => {
  createError.value = null
  newAgentName.value = ''
  newAgentProvider.value = 'openclaw'
  showAddModal.value = true
}

const closeApiKeyModal = () => {
  showApiKeyModal.value = false
  generatedAgentKey.value = null
  copiedKey.value = false
}

const copyGeneratedKey = async () => {
  const apiKey = generatedAgentKey.value?.apiKey
  if (!apiKey) return

  try {
    await navigator.clipboard.writeText(apiKey)
    copiedKey.value = true
    setTimeout(() => {
      copiedKey.value = false
    }, 2000)
  } catch {
    // no-op
  }
}

const revealKey = (payload: { name: string; provider: string; apiKey: string }) => {
  generatedAgentKey.value = payload
  copiedKey.value = false
  showApiKeyModal.value = true
}

const createAgent = async () => {
  if (!workspaceId.value || creating.value) return

  const name = newAgentName.value.trim()
  if (!name) {
    createError.value = 'Agent name is required'
    return
  }

  creating.value = true
  createError.value = null

  try {
    const created: any = await $fetch(`/api/workspaces/${workspaceId.value}/agents`, {
      method: 'POST',
      body: {
        name,
        provider: newAgentProvider.value,
      },
    })

    const keyResult: any = await $fetch(`/api/admin/agents/${created.id}/regenerate-key`, {
      method: 'POST',
    })

    resetAddModal()
    await fetchAgents()

    revealKey({
      name: created.name || name,
      provider: created.provider || newAgentProvider.value,
      apiKey: keyResult.apiKey,
    })
  } catch (e: any) {
    createError.value = e?.data?.message || e?.message || 'Failed to create agent'
  } finally {
    creating.value = false
  }
}

const openEditModal = (agent: any) => {
  editAgentId.value = agent.id
  editAgentName.value = agent.name || ''
  editAgentProvider.value = (agent.provider || 'custom').toLowerCase()
  editError.value = null
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editAgentId.value = null
  editAgentName.value = ''
  editAgentProvider.value = 'openclaw'
  editError.value = null
  editing.value = false
}

const saveAgent = async () => {
  if (!workspaceId.value || !editAgentId.value || editing.value) return

  const name = editAgentName.value.trim()
  if (!name) {
    editError.value = 'Agent name is required'
    return
  }

  editing.value = true
  editError.value = null

  try {
    await $fetch(`/api/workspaces/${workspaceId.value}/agents/${editAgentId.value}`, {
      method: 'PATCH',
      body: {
        name,
        provider: editAgentProvider.value,
      },
    })

    closeEditModal()
    await fetchAgents()
  } catch (e: any) {
    editError.value = e?.data?.message || e?.message || 'Failed to update agent'
  } finally {
    editing.value = false
  }
}

const viewApiKey = async (agent: any) => {
  if (regenerating.value) return
  regenerating.value = agent.id

  try {
    const result: any = await $fetch(`/api/admin/agents/${agent.id}/api-key`)
    revealKey({
      name: agent.name,
      provider: agent.provider,
      apiKey: result.apiKey,
    })
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to fetch API key'
  } finally {
    regenerating.value = null
  }
}

const regenerateKey = async () => {
  if (!generatedAgentKey.value) return

  const agent = agents.value?.find((a: any) => a.name === generatedAgentKey.value?.name)
  if (!agent) return

  try {
    const result: any = await $fetch(`/api/admin/agents/${agent.id}/regenerate-key`, {
      method: 'POST',
    })

    generatedAgentKey.value = {
      ...generatedAgentKey.value,
      apiKey: result.apiKey,
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to regenerate API key'
  }
}

const removeAgent = async (agentId: string) => {
  if (!workspaceId.value || removing.value) return

  removing.value = agentId

  try {
    await $fetch(`/api/workspaces/${workspaceId.value}/agents/${agentId}`, {
      method: 'DELETE',
    })
    confirmRemove.value = null
    await fetchAgents()
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to remove agent'
  } finally {
    removing.value = null
  }
}

const launchTerminalForAgent = (agent: { id: string; name: string }) => {
  openLauncherForAgent({
    id: agent.id,
    name: agent.name,
  })
}

watch(workspaceId, async (id) => {
  if (!id) return
  await refreshMembership()
  await fetchAgents()
}, { immediate: true })
</script>

<template>
  <header class="relative z-10 px-6 py-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl font-medium text-slate-900 dark:text-zinc-100 flex items-center gap-2">
          <Icon name="heroicons:cpu-chip" class="w-5 h-5 text-slate-600 dark:text-zinc-300" />
          <span>Agent Teammates</span>
        </h1>
        <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          AI agents that pick up tasks, break down work, and post updates alongside your team.
        </p>
      </div>

      <button
        v-if="isAdmin"
        @click="openAddModal"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
      >
        <Icon name="heroicons:plus" class="w-4 h-4" />
        <span>Add Agent</span>
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-auto px-6 pb-6">
    <div v-if="!isAdmin" class="py-16 text-center text-slate-500 dark:text-zinc-400">
      <Icon name="heroicons:lock-closed" class="w-10 h-10 mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
      <p class="text-sm">Only workspace owners and admins can manage agents.</p>
    </div>

    <div v-else class="space-y-4">
      <div v-if="!isOrgAdmin" class="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-300">
        Organization admin access is required to create agents and regenerate API keys.
      </div>

      <div v-if="error" class="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl text-sm text-rose-600 dark:text-rose-400">
        {{ error }}
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        Loading agents...
      </div>

      <div v-else-if="!agents.length" class="py-14 text-center rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card">
        <Icon name="heroicons:cpu-chip" class="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
        <p class="text-sm text-slate-500 dark:text-zinc-400">No agents added yet</p>
        <p class="text-xs text-slate-400 dark:text-zinc-500 mt-1">Create an agent teammate to start assigning work.</p>
      </div>

      <div v-else class="overflow-hidden rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card">
        <table class="min-w-full divide-y divide-slate-200 dark:divide-white/[0.06]">
          <thead class="bg-slate-50 dark:bg-white/[0.02]">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Agent</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Provider</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Assigned tasks</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Last active</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-white/[0.04]">
            <tr v-for="agent in agents" :key="agent.id" class="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <Icon name="heroicons:cpu-chip" class="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">{{ agent.name }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{{ providerLabel(agent.provider) }}</td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
                    agent.status === 'online'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400'
                  ]"
                >
                  {{ agent.status === 'online' ? 'Online' : 'Offline' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{{ agent.assignedTasks }}</td>
              <td class="px-4 py-3 text-sm text-slate-500 dark:text-zinc-400">{{ formatLastActive(agent.lastActiveAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="launchTerminalForAgent(agent)"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-md transition-colors"
                  >
                    <Icon name="heroicons:command-line" class="w-3.5 h-3.5" />
                    Launch Terminal
                  </button>
                  <button
                    @click="viewApiKey(agent)"
                    :disabled="regenerating === agent.id || !isOrgAdmin"
                    class="px-2.5 py-1 text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-md transition-colors disabled:opacity-50"
                  >
                    {{ regenerating === agent.id ? '...' : 'View API key' }}
                  </button>
                  <button
                    @click="openEditModal(agent)"
                    :disabled="!isOrgAdmin"
                    class="px-2.5 py-1 text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-md transition-colors disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <template v-if="confirmRemove !== agent.id">
                    <button
                      @click="confirmRemove = agent.id"
                      :disabled="!isOrgAdmin"
                      class="px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </template>
                  <template v-else>
                    <button
                      @click="removeAgent(agent.id)"
                      :disabled="removing === agent.id"
                      class="px-2.5 py-1 text-xs text-white bg-rose-500 hover:bg-rose-600 rounded-md transition-colors disabled:opacity-50"
                    >
                      {{ removing === agent.id ? 'Removing...' : 'Confirm' }}
                    </button>
                    <button
                      @click="confirmRemove = null"
                      class="px-2.5 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showAddModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="resetAddModal()">
      <div class="bg-white dark:bg-dm-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">Add agent</h2>
          <button
            @click="resetAddModal()"
            class="inline-flex h-8 w-8 items-center justify-center leading-none rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </button>
        </div>

        <form class="p-6 space-y-4" @submit.prevent="createAgent">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Name</label>
            <input
              v-model="newAgentName"
              type="text"
              maxlength="80"
              placeholder="Release Assistant"
              class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
              autofocus
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Provider</label>
            <select
              v-model="newAgentProvider"
              class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
            >
              <option v-for="option in providerOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>

          <p v-if="createError" class="text-xs text-rose-500 dark:text-rose-400">{{ createError }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="resetAddModal()"
              class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creating || !newAgentName.trim() || !isOrgAdmin"
              class="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {{ creating ? 'Creating...' : 'Create agent' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showEditModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="closeEditModal()">
      <div class="bg-white dark:bg-dm-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">Edit agent</h2>
          <button
            @click="closeEditModal()"
            class="inline-flex h-8 w-8 items-center justify-center leading-none rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </button>
        </div>

        <form class="p-6 space-y-4" @submit.prevent="saveAgent">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Name</label>
            <input
              v-model="editAgentName"
              type="text"
              maxlength="80"
              class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Provider</label>
            <select
              v-model="editAgentProvider"
              class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
            >
              <option v-for="option in providerOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>

          <p v-if="editError" class="text-xs text-rose-500 dark:text-rose-400">{{ editError }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="closeEditModal()"
              class="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="editing || !editAgentName.trim()"
              class="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {{ editing ? 'Saving...' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showApiKeyModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="closeApiKeyModal()">
      <div class="bg-white dark:bg-dm-card rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">Agent API key</h2>
          <button
            @click="closeApiKeyModal()"
            class="inline-flex h-8 w-8 items-center justify-center leading-none rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div class="text-sm text-slate-700 dark:text-zinc-300">
            <p class="font-medium text-slate-900 dark:text-zinc-100">{{ generatedAgentKey?.name }}</p>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{{ providerLabel(generatedAgentKey?.provider) }}</p>
          </div>

          <div class="p-3 rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
            <code class="text-xs break-all text-slate-700 dark:text-zinc-300">{{ generatedAgentKey?.apiKey }}</code>
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              @click="regenerateKey"
              class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Regenerate key
            </button>
            <div class="flex items-center gap-3">
              <button
                @click="copyGeneratedKey"
                class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                {{ copiedKey ? 'Copied!' : 'Copy key' }}
              </button>
              <button
                @click="closeApiKeyModal()"
                class="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
