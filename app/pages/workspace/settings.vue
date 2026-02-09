<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
  middleware: 'auth',
})

const { workspaceId } = useItems()
const { user } = useAuth()
const { pendingInvites, availableInternalSeats, fetchSeats, fetchPendingInvites, sendInvite, cancelInvite } = useSeats()

const activeTab = ref<'general' | 'members' | 'external'>('general')

// Workspace data
const workspace = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const editName = ref('')
const editDescription = ref('')
const saveSuccess = ref(false)

// Members data
const members = ref<any[]>([])
const membersLoading = ref(false)
const updatingRole = ref<string | null>(null)
const removingMember = ref<string | null>(null)
const confirmRemove = ref<string | null>(null)
const deactivatingMember = ref<string | null>(null)
const confirmDeactivate = ref<string | null>(null)
const reactivatingMember = ref<string | null>(null)
const showDeactivated = ref(false)

// External users data
const externalSpaces = ref<any[]>([])
const externalLoading = ref(false)
const updatingStakeholder = ref<string | null>(null)
const removingStakeholder = ref<string | null>(null)
const confirmRemoveStakeholder = ref<string | null>(null)
const collapsedSpaces = ref<Set<string>>(new Set())

// Plan & usage data
const usageData = ref<any>(null)
const usageLoading = ref(false)
const showUpgradeModal = ref(false)
const upgradeMessage = ref('')

// Seat action modal (after deactivation)
const showSeatAction = ref(false)
const seatActionSeatId = ref<string | null>(null)
const seatActionMemberName = ref('')

// Buy seats modal
const showBuySeats = ref(false)

// Invite link copying
const copiedLink = ref(false)
const lastInviteLink = ref<string | null>(null)

// Cancelling invite
const cancellingInvite = ref<string | null>(null)

// Check admin status
const { data: membership, refresh: refreshMembership } = useFetch('/api/workspaces/membership', {
  query: computed(() => ({ workspaceId: workspaceId.value })),
  immediate: false,
})

const isAdmin = computed(() => {
  const role = membership.value?.role
  return role === 'OWNER' || role === 'ADMIN'
})

const isOwner = computed(() => membership.value?.role === 'OWNER')

const fetchWorkspace = async () => {
  if (!workspaceId.value) return
  loading.value = true
  try {
    workspace.value = await $fetch(`/api/workspaces/${workspaceId.value}`)
    editName.value = workspace.value.name
    editDescription.value = workspace.value.description || ''
  } catch (e) {
    console.error('Failed to fetch workspace:', e)
  } finally {
    loading.value = false
  }
}

const fetchMembers = async () => {
  if (!workspaceId.value) return
  membersLoading.value = true
  try {
    members.value = await $fetch(`/api/workspaces/${workspaceId.value}/members`, {
      query: { includeDeactivated: 'true' },
    })
  } catch (e) {
    console.error('Failed to fetch members:', e)
  } finally {
    membersLoading.value = false
  }
}

const activeMembers = computed(() => members.value.filter(m => m.status === 'ACTIVE'))
const deactivatedMembers = computed(() => members.value.filter(m => m.status === 'DEACTIVATED'))

const fetchExternalUsers = async () => {
  if (!workspaceId.value) return
  externalLoading.value = true
  try {
    externalSpaces.value = await $fetch(`/api/workspaces/${workspaceId.value}/external-users`)
  } catch (e) {
    console.error('Failed to fetch external users:', e)
  } finally {
    externalLoading.value = false
  }
}

const fetchUsage = async () => {
  if (!workspaceId.value) return
  usageLoading.value = true
  try {
    usageData.value = await $fetch(`/api/workspaces/${workspaceId.value}/usage`)
  } catch (e) {
    console.error('Failed to fetch usage:', e)
  } finally {
    usageLoading.value = false
  }
}

// Seat counts for BuySeatsModal
const totalInternalSeats = computed(() => usageData.value?.usage?.internalSeats?.total ?? 0)
const totalExternalSeats = computed(() => usageData.value?.usage?.externalSeats?.total ?? 0)

const saveWorkspace = async () => {
  if (!workspaceId.value || saving.value) return
  saving.value = true
  try {
    await $fetch(`/api/workspaces/${workspaceId.value}`, {
      method: 'PATCH',
      body: { name: editName.value, description: editDescription.value },
    })
    saveSuccess.value = true
    setTimeout(() => saveSuccess.value = false, 2000)
    await fetchWorkspace()
  } catch (e) {
    console.error('Failed to save workspace:', e)
  } finally {
    saving.value = false
  }
}

const updateMemberRole = async (userId: string, role: string) => {
  if (!workspaceId.value) return
  updatingRole.value = userId
  try {
    await $fetch(`/api/workspaces/${workspaceId.value}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    })
    await fetchMembers()
  } catch (e) {
    console.error('Failed to update role:', e)
  } finally {
    updatingRole.value = null
  }
}

// Invite member (seat-aware)
const inviteEmail = ref('')
const inviteRole = ref('MEMBER')
const inviting = ref(false)
const inviteError = ref<string | null>(null)
const inviteSuccess = ref(false)

const inviteMember = async () => {
  if (!workspaceId.value || !inviteEmail.value.trim() || inviting.value) return
  inviting.value = true
  inviteError.value = null
  lastInviteLink.value = null
  try {
    const result = await sendInvite(inviteEmail.value.trim(), inviteRole.value)
    inviteEmail.value = ''
    inviteRole.value = 'MEMBER'
    inviteSuccess.value = true

    // If it returned an invite link, store it for copying
    if (result?.inviteLink) {
      lastInviteLink.value = result.inviteLink
    }

    setTimeout(() => {
      inviteSuccess.value = false
      lastInviteLink.value = null
      copiedLink.value = false
    }, 10000)

    await Promise.all([fetchMembers(), fetchUsage()])
  } catch (e: any) {
    const statusCode = e?.statusCode || e?.data?.statusCode
    if (statusCode === 403 && (e?.data?.message?.includes('seat') || e?.data?.message?.includes('limit'))) {
      upgradeMessage.value = e?.data?.message || 'No available seats.'
      showUpgradeModal.value = true
    } else {
      inviteError.value = e?.data?.message || 'Failed to invite member'
    }
  } finally {
    inviting.value = false
  }
}

const copyInviteLink = async () => {
  if (!lastInviteLink.value) return
  try {
    await navigator.clipboard.writeText(lastInviteLink.value)
    copiedLink.value = true
    setTimeout(() => copiedLink.value = false, 3000)
  } catch {
    // Fallback
  }
}

const handleCancelInvite = async (inviteId: string) => {
  cancellingInvite.value = inviteId
  try {
    await cancelInvite(inviteId)
    await fetchUsage()
  } catch (e) {
    console.error('Failed to cancel invite:', e)
  } finally {
    cancellingInvite.value = null
  }
}

const removeMember = async (userId: string) => {
  if (!workspaceId.value) return
  removingMember.value = userId
  try {
    const result = await $fetch(`/api/workspaces/${workspaceId.value}/members/${userId}`, {
      method: 'DELETE',
    }) as any
    confirmRemove.value = null

    // Show seat action modal if member had a seat
    if (result.seatId) {
      const member = members.value.find(m => m.userId === userId)
      seatActionSeatId.value = result.seatId
      seatActionMemberName.value = member?.name || member?.email || 'This member'
      showSeatAction.value = true
    }

    await Promise.all([fetchMembers(), fetchUsage(), fetchSeats()])
  } catch (e) {
    console.error('Failed to remove member:', e)
  } finally {
    removingMember.value = null
  }
}

const deactivateMember = async (userId: string) => {
  if (!workspaceId.value) return
  deactivatingMember.value = userId
  try {
    const result = await $fetch(`/api/workspaces/${workspaceId.value}/members/${userId}`, {
      method: 'PATCH',
      body: { status: 'DEACTIVATED' },
    }) as any
    confirmDeactivate.value = null

    // Show seat action modal if member has a seat
    if (result.seatId) {
      seatActionSeatId.value = result.seatId
      seatActionMemberName.value = result.name || result.email || 'This member'
      showSeatAction.value = true
    }

    await Promise.all([fetchMembers(), fetchUsage(), fetchSeats()])
  } catch (e: any) {
    console.error('Failed to deactivate member:', e)
  } finally {
    deactivatingMember.value = null
  }
}

const reactivateMember = async (userId: string) => {
  if (!workspaceId.value) return
  reactivatingMember.value = userId
  try {
    await $fetch(`/api/workspaces/${workspaceId.value}/members/${userId}`, {
      method: 'PATCH',
      body: { status: 'ACTIVE' },
    })
    await Promise.all([fetchMembers(), fetchUsage(), fetchSeats()])
  } catch (e: any) {
    const msg = e?.data?.message || 'Failed to reactivate member'
    if (e?.data?.statusCode === 403) {
      upgradeMessage.value = msg
      showUpgradeModal.value = true
    } else {
      console.error('Failed to reactivate member:', msg)
    }
  } finally {
    reactivatingMember.value = null
  }
}

const handleSeatActionDone = async () => {
  await Promise.all([fetchUsage(), fetchSeats()])
}

const toggleStakeholderTasks = async (space: any, stakeholder: any) => {
  const key = `${space.id}-${stakeholder.userId}`
  updatingStakeholder.value = key
  try {
    await $fetch(`/api/projects/${space.project.id}/spaces/${space.id}/stakeholders/${stakeholder.userId}`, {
      method: 'PATCH',
      body: { canSubmitTasks: !stakeholder.canSubmitTasks },
    })
    await fetchExternalUsers()
  } catch (e) {
    console.error('Failed to update stakeholder:', e)
  } finally {
    updatingStakeholder.value = null
  }
}

const removeStakeholder = async (space: any, stakeholder: any) => {
  const key = `${space.id}-${stakeholder.userId}`
  removingStakeholder.value = key
  try {
    await $fetch(`/api/projects/${space.project.id}/spaces/${space.id}/stakeholders/${stakeholder.userId}`, {
      method: 'DELETE',
    })
    confirmRemoveStakeholder.value = null
    await fetchExternalUsers()
  } catch (e) {
    console.error('Failed to remove stakeholder:', e)
  } finally {
    removingStakeholder.value = null
  }
}

const toggleSpace = (spaceId: string) => {
  const next = new Set(collapsedSpaces.value)
  if (next.has(spaceId)) next.delete(spaceId)
  else next.add(spaceId)
  collapsedSpaces.value = next
}

const totalExternalUsers = computed(() => {
  const seen = new Set<string>()
  for (const space of externalSpaces.value) {
    for (const s of space.stakeholders) seen.add(s.userId)
  }
  return seen.size
})

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
]

const getRoleColor = (role: string) => {
  switch (role) {
    case 'OWNER': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    case 'ADMIN': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
    case 'MEMBER': return 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-zinc-300'
    case 'VIEWER': return 'bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-zinc-400'
    default: return 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-zinc-300'
  }
}

const tabs = computed(() => [
  { key: 'general', label: 'General', icon: 'heroicons:cog-6-tooth' },
  { key: 'members', label: 'Members', icon: 'heroicons:users' },
  { key: 'external', label: 'External Users', icon: 'heroicons:globe-alt' },
])

const formatExpiry = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Expired'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

watch(workspaceId, (id) => {
  if (!id) return
  refreshMembership()
  fetchWorkspace()
  fetchMembers()
  fetchExternalUsers()
  fetchUsage()
  fetchSeats()
  fetchPendingInvites()
}, { immediate: true })

// Listen for tab switch events from UpgradeModal
onMounted(() => {
  const handler = (e: Event) => {
    const tab = (e as CustomEvent).detail
    if (['general', 'members', 'external'].includes(tab)) {
      activeTab.value = tab
    }
  }
  window.addEventListener('switch-settings-tab', handler)
  onUnmounted(() => window.removeEventListener('switch-settings-tab', handler))
})
</script>

<template>
  <header class="relative z-10 px-6 py-5">
    <h1 class="text-xl font-medium text-slate-900 dark:text-zinc-100">Workspace Settings</h1>
    <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Manage your workspace configuration and members</p>
  </header>

  <div class="flex-1 overflow-auto px-6 pb-6">
    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-slate-200 dark:border-white/[0.06]">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key as typeof activeTab"
        :class="[
          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === tab.key
            ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300'
        ]"
      >
        <Icon :name="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </div>

    <!-- General Settings -->
    <div v-if="activeTab === 'general'" class="max-w-2xl">
      <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        Loading workspace...
      </div>

      <div v-else class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Workspace name</label>
          <input
            v-model="editName"
            type="text"
            :disabled="!isOwner"
            class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-white/[0.04]"
            placeholder="Workspace name"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Description</label>
          <textarea
            v-model="editDescription"
            :disabled="!isOwner"
            rows="3"
            class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300 resize-none disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-white/[0.04]"
            placeholder="Optional workspace description..."
          />
        </div>

        <div v-if="workspace" class="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-500 dark:text-zinc-400">Organization</span>
              <p class="text-slate-900 dark:text-zinc-100 font-medium">{{ workspace.organizationName }}</p>
            </div>
            <div>
              <span class="text-slate-500 dark:text-zinc-400">Created</span>
              <p class="text-slate-900 dark:text-zinc-100 font-medium">{{ new Date(workspace.createdAt).toLocaleDateString() }}</p>
            </div>
            <div>
              <span class="text-slate-500 dark:text-zinc-400">Members</span>
              <p class="text-slate-900 dark:text-zinc-100 font-medium">{{ workspace.memberCount }}</p>
            </div>
            <div>
              <span class="text-slate-500 dark:text-zinc-400">Items</span>
              <p class="text-slate-900 dark:text-zinc-100 font-medium">{{ workspace.itemCount }}</p>
            </div>
          </div>
        </div>

        <div v-if="isOwner" class="flex items-center gap-3 pt-2">
          <button
            @click="saveWorkspace"
            :disabled="saving"
            class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save changes' }}
          </button>
          <span v-if="saveSuccess" class="text-sm text-emerald-600 flex items-center gap-1">
            <Icon name="heroicons:check" class="w-4 h-4" />
            Saved
          </span>
        </div>
      </div>
    </div>

    <!-- Members -->
    <div v-if="activeTab === 'members'" class="max-w-3xl">
      <!-- Invite form -->
      <div v-if="isAdmin" class="mb-6 p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100">Invite a member</h3>
          <span v-if="availableInternalSeats > 0" class="text-xs text-slate-500 dark:text-zinc-400">
            {{ availableInternalSeats }} {{ availableInternalSeats === 1 ? 'seat' : 'seats' }} available
          </span>
          <button
            v-else-if="isOwner"
            @click="showBuySeats = true"
            class="text-xs text-slate-900 dark:text-zinc-100 font-medium underline underline-offset-2 hover:text-slate-700 dark:hover:text-zinc-300"
          >
            Purchase seats
          </button>
          <span v-else class="text-xs text-amber-600 dark:text-amber-400">No seats available</span>
        </div>
        <form @submit.prevent="inviteMember" class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Email address</label>
            <input
              v-model="inviteEmail"
              type="email"
              required
              placeholder="colleague@company.com"
              class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
            />
          </div>
          <div class="w-32">
            <label class="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Role</label>
            <select
              v-model="inviteRole"
              class="w-full px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg text-sm bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            :disabled="inviting || !inviteEmail.trim()"
            class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {{ inviting ? 'Inviting...' : 'Send invite' }}
          </button>
        </form>
        <p v-if="inviteError" class="text-xs text-red-500 mt-2">{{ inviteError }}</p>
        <div v-if="inviteSuccess" class="mt-2">
          <p v-if="!lastInviteLink" class="text-xs text-emerald-600 flex items-center gap-1">
            <Icon name="heroicons:check" class="w-3.5 h-3.5" />
            Member added directly (already had a seat)
          </p>
          <div v-else class="flex items-center gap-2">
            <p class="text-xs text-emerald-600 flex items-center gap-1">
              <Icon name="heroicons:check" class="w-3.5 h-3.5" />
              Invite created!
            </p>
            <button
              @click="copyInviteLink"
              class="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-zinc-300 rounded hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors flex items-center gap-1"
            >
              <Icon :name="copiedLink ? 'heroicons:check' : 'heroicons:clipboard'" class="w-3 h-3" />
              {{ copiedLink ? 'Copied!' : 'Copy link' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Pending invites -->
      <div v-if="isAdmin && pendingInvites.length" class="mb-6 p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
        <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100 mb-3">
          Pending invites
          <span class="text-slate-400 dark:text-zinc-500 font-normal">({{ pendingInvites.length }})</span>
        </h3>
        <div class="space-y-2">
          <div
            v-for="inv in pendingInvites"
            :key="inv.id"
            class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04]"
          >
            <div class="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:envelope" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-slate-900 dark:text-zinc-100 truncate">{{ inv.email }}</div>
              <div class="text-xs text-slate-400 dark:text-zinc-500">
                {{ inv.role }} &middot; {{ formatExpiry(inv.expiresAt) }}
                <span v-if="inv.workspace"> &middot; {{ inv.workspace.name }}</span>
              </div>
            </div>
            <button
              @click="handleCancelInvite(inv.id)"
              :disabled="cancellingInvite === inv.id"
              class="text-xs px-2 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
            >
              {{ cancellingInvite === inv.id ? '...' : 'Cancel' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="membersLoading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        Loading members...
      </div>

      <div v-else class="space-y-4">
        <!-- Active members -->
        <div class="space-y-1">
          <div
            v-for="member in activeMembers"
            :key="member.id"
            class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <!-- Avatar -->
            <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <span class="text-xs font-medium text-slate-600 dark:text-zinc-400">
                {{ (member.name || member.email)?.[0]?.toUpperCase() || '?' }}
              </span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                {{ member.name || member.email }}
                <span v-if="member.userId === user?.id" class="text-slate-400 dark:text-zinc-500 font-normal">(you)</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-zinc-400 truncate">{{ member.email }}</div>
            </div>

            <!-- Role badge / selector -->
            <div class="flex items-center gap-2">
              <span
                v-if="member.role === 'OWNER' || !isOwner || member.userId === user?.id"
                :class="['text-xs font-medium px-2 py-0.5 rounded-full', getRoleColor(member.role)]"
              >
                {{ member.role }}
              </span>
              <select
                v-else
                :value="member.role"
                @change="updateMemberRole(member.userId, ($event.target as HTMLSelectElement).value)"
                :disabled="updatingRole === member.userId"
                class="text-xs border border-slate-200 dark:border-white/[0.06] rounded-md px-2 py-1 bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-zinc-600"
              >
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>

              <!-- Deactivate button -->
              <div v-if="isOwner && member.role !== 'OWNER' && member.userId !== user?.id" class="relative">
                <button
                  v-if="confirmDeactivate !== member.userId"
                  @click="confirmDeactivate = member.userId"
                  class="p-1 text-slate-400 dark:text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors rounded"
                  title="Deactivate member"
                >
                  <Icon name="heroicons:pause-circle" class="w-4 h-4" />
                </button>
                <div v-else class="flex items-center gap-1">
                  <button
                    @click="deactivateMember(member.userId)"
                    :disabled="deactivatingMember === member.userId"
                    class="text-xs px-2 py-0.5 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                  >
                    {{ deactivatingMember === member.userId ? '...' : 'Deactivate' }}
                  </button>
                  <button
                    @click="confirmDeactivate = null"
                    class="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400 rounded hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!activeMembers.length" class="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
            No active members found
          </div>
        </div>

        <!-- Deactivated members section -->
        <div v-if="deactivatedMembers.length" class="mt-4">
          <button
            @click="showDeactivated = !showDeactivated"
            class="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors mb-2"
          >
            <Icon
              :name="showDeactivated ? 'heroicons:chevron-down' : 'heroicons:chevron-right'"
              class="w-4 h-4"
            />
            {{ deactivatedMembers.length }} deactivated {{ deactivatedMembers.length === 1 ? 'member' : 'members' }}
          </button>

          <div v-if="showDeactivated" class="space-y-1">
            <div
              v-for="member in deactivatedMembers"
              :key="member.id"
              class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors opacity-60"
            >
              <!-- Avatar -->
              <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <span class="text-xs font-medium text-slate-400 dark:text-zinc-500">
                  {{ (member.name || member.email)?.[0]?.toUpperCase() || '?' }}
                </span>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-500 dark:text-zinc-400 truncate">
                  {{ member.name || member.email }}
                </div>
                <div class="text-xs text-slate-400 dark:text-zinc-500 truncate">{{ member.email }}</div>
              </div>

              <!-- Status + role badges -->
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 dark:bg-white/[0.08] dark:text-zinc-500">
                  Deactivated
                </span>
                <span :class="['text-xs font-medium px-2 py-0.5 rounded-full', getRoleColor(member.role)]">
                  {{ member.role }}
                </span>

                <!-- Reactivate button -->
                <button
                  v-if="isOwner"
                  @click="reactivateMember(member.userId)"
                  :disabled="reactivatingMember === member.userId"
                  class="text-xs px-2 py-0.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {{ reactivatingMember === member.userId ? '...' : 'Reactivate' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- External Users -->
    <div v-if="activeTab === 'external'" class="max-w-3xl">
      <div v-if="externalLoading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
        <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        Loading external users...
      </div>

      <div v-else-if="!externalSpaces.length" class="py-12 text-center">
        <Icon name="heroicons:globe-alt" class="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
        <p class="text-sm text-slate-500 dark:text-zinc-400">No external spaces configured yet</p>
        <p class="text-xs text-slate-400 dark:text-zinc-500 mt-1">Create an external space in a project to invite stakeholders</p>
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-slate-500 dark:text-zinc-400">
          {{ totalExternalUsers }} external {{ totalExternalUsers === 1 ? 'user' : 'users' }} across {{ externalSpaces.length }} {{ externalSpaces.length === 1 ? 'space' : 'spaces' }}
        </p>

        <div
          v-for="space in externalSpaces"
          :key="space.id"
          class="bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden"
        >
          <!-- Space header -->
          <button
            @click="toggleSpace(space.id)"
            class="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-left"
          >
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:globe-alt" class="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">{{ space.name }}</div>
              <div class="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {{ space.project.title }}
                <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                {{ space.stakeholders.length }} {{ space.stakeholders.length === 1 ? 'user' : 'users' }}
              </div>
            </div>
            <Icon
              :name="collapsedSpaces.has(space.id) ? 'heroicons:chevron-down' : 'heroicons:chevron-up'"
              class="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0"
            />
          </button>

          <!-- Stakeholders -->
          <div v-if="!collapsedSpaces.has(space.id)" class="border-t border-slate-100 dark:border-white/[0.06]">
            <div v-if="!space.stakeholders.length" class="px-5 py-4 text-sm text-slate-400 dark:text-zinc-500 italic">
              No external users in this space
            </div>

            <div
              v-for="stakeholder in space.stakeholders"
              :key="stakeholder.userId"
              class="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors border-b border-slate-50 dark:border-white/[0.06] last:border-b-0"
            >
              <!-- Avatar -->
              <div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <span class="text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                  {{ (stakeholder.name || stakeholder.email)?.[0]?.toUpperCase() || '?' }}
                </span>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                  {{ stakeholder.name || stakeholder.email }}
                </div>
                <div class="text-xs text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                  {{ stakeholder.email }}
                  <span v-if="stakeholder.position" class="text-slate-300 dark:text-zinc-600">&middot;</span>
                  <span v-if="stakeholder.position" class="text-slate-400 dark:text-zinc-500">{{ stakeholder.position }}</span>
                </div>
              </div>

              <!-- Controls -->
              <div v-if="isOwner" class="flex items-center gap-2 flex-shrink-0">
                <!-- Task submission toggle -->
                <button
                  @click.stop="toggleStakeholderTasks(space, stakeholder)"
                  :disabled="updatingStakeholder === `${space.id}-${stakeholder.userId}`"
                  :class="[
                    'text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors',
                    (stakeholder.canSubmitTasks ?? space.allowTaskSubmission)
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/[0.08] dark:text-zinc-400 dark:hover:bg-white/[0.06]'
                  ]"
                  :title="(stakeholder.canSubmitTasks ?? space.allowTaskSubmission) ? 'Can submit tasks (click to revoke)' : 'Cannot submit tasks (click to grant)'"
                >
                  {{ (stakeholder.canSubmitTasks ?? space.allowTaskSubmission) ? 'Can submit tasks' : 'View only' }}
                </button>

                <!-- Remove button -->
                <div class="relative">
                  <button
                    v-if="confirmRemoveStakeholder !== `${space.id}-${stakeholder.userId}`"
                    @click.stop="confirmRemoveStakeholder = `${space.id}-${stakeholder.userId}`"
                    class="p-1 text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors rounded"
                    title="Remove from space"
                  >
                    <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
                  </button>
                  <div v-else class="flex items-center gap-1" @click.stop>
                    <button
                      @click="removeStakeholder(space, stakeholder)"
                      :disabled="removingStakeholder === `${space.id}-${stakeholder.userId}`"
                      class="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      {{ removingStakeholder === `${space.id}-${stakeholder.userId}` ? '...' : 'Remove' }}
                    </button>
                    <button
                      @click="confirmRemoveStakeholder = null"
                      class="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400 rounded hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              <!-- Read-only badge for non-owners -->
              <div v-else class="flex-shrink-0">
                <span
                  :class="[
                    'text-[10px] font-medium px-2 py-0.5 rounded-full',
                    (stakeholder.canSubmitTasks ?? space.allowTaskSubmission)
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-zinc-400'
                  ]"
                >
                  {{ (stakeholder.canSubmitTasks ?? space.allowTaskSubmission) ? 'Can submit tasks' : 'View only' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <UpgradeModal
    :open="showUpgradeModal"
    :message="upgradeMessage"
    @close="showUpgradeModal = false"
  />

  <BuySeatsModal
    :open="showBuySeats"
    :plan-tier="usageData?.planTier"
    :current-internal="totalInternalSeats"
    :current-external="totalExternalSeats"
    @close="showBuySeats = false"
    @purchased="fetchUsage"
  />

  <SeatActionModal
    :open="showSeatAction"
    :seat-id="seatActionSeatId"
    :member-name="seatActionMemberName"
    @close="showSeatAction = false"
    @done="handleSeatActionDone"
  />
</template>
