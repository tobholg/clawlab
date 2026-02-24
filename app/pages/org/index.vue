<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
  middleware: 'auth',
})

const router = useRouter()
const { user } = useAuth()
const { isOrgAdmin, currentWorkspace, switchWorkspace } = useWorkspaces()
const {
  organizationId,
  orgDetails,
  orgMembers,
  orgWorkspaces,
  loading,
  membersLoading,
  workspacesLoading,
  isOrgOwner,
  fetchOrgDetails,
  updateOrg,
  fetchOrgMembers,
  fetchOrgWorkspaces,
} = useOrganization()
const { pendingInvites, fetchSeats, fetchPendingInvites } = useSeats()

// Guard: redirect non-admins
watch(isOrgAdmin, (val) => {
  if (val === false) router.replace('/workspace')
}, { immediate: true })

const activeTab = ref<'overview' | 'workspaces' | 'members' | 'limits'>('overview')

// Editing state
const editingName = ref(false)
const editName = ref('')
const editingEmail = ref(false)
const editEmail = ref('')
const saving = ref(false)
const saveSuccess = ref(false)

// Members state
const showDeactivated = ref(false)

const activeOrgMembers = computed(() => orgMembers.value.filter(m => m.status === 'ACTIVE'))
const deactivatedOrgMembers = computed(() => orgMembers.value.filter(m => m.status === 'DEACTIVATED'))

// Formatting helpers
const formatLimit = (limit: number) => {
  if (limit === Infinity || limit > 999999) return 'Unlimited'
  return limit.toLocaleString()
}

const usagePercent = (current: number, limit: number) => {
  if (limit === Infinity || limit === 0 || limit > 999999) return 0
  return Math.min(100, Math.round((current / limit) * 100))
}

const usageBarColor = (current: number, limit: number) => {
  const pct = usagePercent(current, limit)
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-slate-900 dark:bg-zinc-100'
}

const tierLabel = computed(() => {
  return 'Self-hosted'
})

const tierColor = computed(() => {
  return 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400'
})

const getRoleColor = (role: string) => {
  switch (role) {
    case 'OWNER': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    case 'ADMIN': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
    case 'MEMBER': return 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-zinc-300'
    default: return 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-zinc-300'
  }
}

const seatBreakdown = (seatData: any) => {
  if (!seatData) return null
  return {
    occupied: seatData.occupied ?? 0,
    invited: seatData.invited ?? 0,
    available: seatData.available ?? 0,
    total: seatData.total ?? 0,
  }
}

const seatBarSegments = (data: any) => {
  if (!data || data.total === 0) return []
  const total = data.total
  return [
    { width: (data.occupied / total) * 100, color: 'bg-slate-900 dark:bg-zinc-100', label: 'Occupied' },
    { width: (data.invited / total) * 100, color: 'bg-amber-400', label: 'Invited' },
    { width: (data.available / total) * 100, color: 'bg-slate-200 dark:bg-white/[0.06]', label: 'Available' },
  ].filter(s => s.width > 0)
}

// Quick stats
const totalMembers = computed(() => activeOrgMembers.value.length)
const totalWorkspaces = computed(() => orgWorkspaces.value.length)
const totalSeatsUsed = computed(() => {
  const internal = orgDetails.value?.usage?.internalSeats
  const external = orgDetails.value?.usage?.externalSeats
  return (internal?.occupied ?? 0) + (external?.occupied ?? 0)
})
const totalSeatsAvailable = computed(() => {
  const internal = orgDetails.value?.usage?.internalSeats
  const external = orgDetails.value?.usage?.externalSeats
  return (internal?.total ?? 0) + (external?.total ?? 0)
})
const totalProjects = computed(() => orgDetails.value?.usage?.projects?.current ?? 0)

// Actions
const startEditName = () => {
  editName.value = orgDetails.value?.name ?? ''
  editingName.value = true
}

const saveName = async () => {
  if (saving.value || !editName.value.trim()) return
  saving.value = true
  try {
    await updateOrg({ name: editName.value.trim() })
    editingName.value = false
    saveSuccess.value = true
    setTimeout(() => saveSuccess.value = false, 2000)
  } catch (e) {
    console.error('Failed to save name:', e)
  } finally {
    saving.value = false
  }
}

const startEditEmail = () => {
  editEmail.value = orgDetails.value?.billingEmail ?? ''
  editingEmail.value = true
}

const saveEmail = async () => {
  if (saving.value) return
  saving.value = true
  try {
    await updateOrg({ billingEmail: editEmail.value.trim() || null })
    editingEmail.value = false
    saveSuccess.value = true
    setTimeout(() => saveSuccess.value = false, 2000)
  } catch (e) {
    console.error('Failed to save email:', e)
  } finally {
    saving.value = false
  }
}

const handleWorkspaceClick = (wsId: string) => {
  switchWorkspace(wsId)
  router.push('/workspace')
}

const formatExpiry = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Expired'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

// Cancelling invite
const cancellingInvite = ref<string | null>(null)
const { cancelInvite } = useSeats()
const handleCancelInvite = async (inviteId: string) => {
  cancellingInvite.value = inviteId
  try {
    await cancelInvite(inviteId)
    await fetchOrgDetails()
  } catch (e) {
    console.error('Failed to cancel invite:', e)
  } finally {
    cancellingInvite.value = null
  }
}

const tabs = [
  { key: 'overview', label: 'Overview', icon: 'heroicons:building-office-2' },
  { key: 'workspaces', label: 'Workspaces', icon: 'heroicons:squares-2x2' },
  { key: 'members', label: 'Members', icon: 'heroicons:users' },
  { key: 'limits', label: 'Usage & Limits', icon: 'heroicons:adjustments-horizontal' },
]

// Fetch data
watch(organizationId, (id) => {
  if (!id) return
  fetchOrgDetails()
  fetchOrgMembers()
  fetchOrgWorkspaces()
  fetchSeats()
  fetchPendingInvites()
}, { immediate: true })
</script>

<template>
  <div v-if="isOrgAdmin">
    <header class="relative z-10 px-6 py-5">
      <h1 class="text-xl font-medium text-slate-900 dark:text-zinc-100">Organization</h1>
      <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Manage your organization settings, members, and limits</p>
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

      <!-- ==================== OVERVIEW TAB ==================== -->
      <div v-if="activeTab === 'overview'" class="max-w-3xl">
        <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading organization...
        </div>

        <div v-else-if="orgDetails" class="space-y-6">
          <!-- Org info card -->
          <div class="p-5 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100">Organization details</h3>
              <span :class="['text-xs font-semibold px-2.5 py-1 rounded-full', tierColor]">
                {{ tierLabel }}
              </span>
            </div>

            <div class="space-y-4">
              <!-- Name -->
              <div>
                <label class="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Name</label>
                <div v-if="!editingName" class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900 dark:text-zinc-100">{{ orgDetails.name }}</span>
                  <button
                    v-if="isOrgOwner"
                    @click="startEditName"
                    class="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 transition-colors rounded"
                  >
                    <Icon name="heroicons:pencil" class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <input
                    v-model="editName"
                    type="text"
                    maxlength="255"
                    class="flex-1 px-3 py-1.5 border border-slate-200 dark:border-white/[0.06] dark:bg-dm-card dark:text-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
                    @keydown.enter="saveName"
                    @keydown.escape="editingName = false"
                  />
                  <button
                    @click="saveName"
                    :disabled="saving"
                    class="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    @click="editingName = false"
                    class="px-3 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Slug -->
              <div>
                <label class="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Slug</label>
                <span class="text-sm text-slate-700 dark:text-zinc-300">{{ orgDetails.slug }}</span>
              </div>

              <!-- Contact email -->
              <div>
                <label class="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Contact email</label>
                <div v-if="!editingEmail" class="flex items-center gap-2">
                  <span class="text-sm text-slate-700 dark:text-zinc-300">{{ orgDetails.billingEmail || 'Not set' }}</span>
                  <button
                    @click="startEditEmail"
                    class="p-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400 transition-colors rounded"
                  >
                    <Icon name="heroicons:pencil" class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <input
                    v-model="editEmail"
                    type="email"
                    placeholder="ops@company.com"
                    class="flex-1 px-3 py-1.5 border border-slate-200 dark:border-white/[0.06] dark:bg-dm-card dark:text-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-zinc-600 focus:border-slate-300"
                    @keydown.enter="saveEmail"
                    @keydown.escape="editingEmail = false"
                  />
                  <button
                    @click="saveEmail"
                    :disabled="saving"
                    class="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    @click="editingEmail = false"
                    class="px-3 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Created -->
              <div>
                <label class="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Created</label>
                <span class="text-sm text-slate-700 dark:text-zinc-300">{{ new Date(orgDetails.createdAt).toLocaleDateString() }}</span>
              </div>
            </div>

            <span v-if="saveSuccess" class="text-xs text-emerald-600 flex items-center gap-1 mt-3">
              <Icon name="heroicons:check" class="w-3.5 h-3.5" />
              Saved
            </span>
          </div>

          <!-- Quick stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
              <div class="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">{{ totalMembers }}</div>
              <div class="text-xs text-slate-500 dark:text-zinc-400 mt-1">Active members</div>
            </div>
            <div class="p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
              <div class="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">{{ totalWorkspaces }}</div>
              <div class="text-xs text-slate-500 dark:text-zinc-400 mt-1">Workspaces</div>
            </div>
            <div class="p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
              <div class="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">{{ totalSeatsUsed }} / {{ totalSeatsAvailable }}</div>
              <div class="text-xs text-slate-500 dark:text-zinc-400 mt-1">Seats used</div>
            </div>
            <div class="p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
              <div class="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">{{ totalProjects }}</div>
              <div class="text-xs text-slate-500 dark:text-zinc-400 mt-1">Projects</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== WORKSPACES TAB ==================== -->
      <div v-if="activeTab === 'workspaces'" class="max-w-3xl">
        <div v-if="workspacesLoading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading workspaces...
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="ws in orgWorkspaces"
            :key="ws.id"
            @click="handleWorkspaceClick(ws.id)"
            class="p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.08] hover:shadow-sm cursor-pointer transition-all"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">{{ ws.name }}</h3>
                  <span
                    v-if="currentWorkspace?.id === ws.id"
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    Current
                  </span>
                </div>
                <p v-if="ws.description" class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">{{ ws.description }}</p>
              </div>
              <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
            </div>
            <div class="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-zinc-400">
              <span class="flex items-center gap-1">
                <Icon name="heroicons:users" class="w-3.5 h-3.5" />
                {{ ws.memberCount }} members
              </span>
              <span class="flex items-center gap-1">
                <Icon name="heroicons:folder" class="w-3.5 h-3.5" />
                {{ ws.projectCount }} projects
              </span>
              <span class="flex items-center gap-1">
                <Icon name="heroicons:document-text" class="w-3.5 h-3.5" />
                {{ ws.itemCount }} items
              </span>
              <span class="text-slate-400 dark:text-zinc-500">
                Created {{ new Date(ws.createdAt).toLocaleDateString() }}
              </span>
            </div>
          </div>

          <div v-if="!orgWorkspaces.length" class="py-12 text-center">
            <Icon name="heroicons:squares-2x2" class="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <p class="text-sm text-slate-500 dark:text-zinc-400">No workspaces yet</p>
          </div>
        </div>
      </div>

      <!-- ==================== MEMBERS TAB ==================== -->
      <div v-if="activeTab === 'members'" class="max-w-3xl">
        <!-- Pending invites -->
        <div v-if="pendingInvites.length" class="mb-6 p-4 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
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
                <Icon name="heroicons:envelope" class="w-3.5 h-3.5 text-amber-600" />
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
              v-for="member in activeOrgMembers"
              :key="member.id"
              class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <span class="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  {{ (member.name || member.email)?.[0]?.toUpperCase() || '?' }}
                </span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                  {{ member.name || member.email }}
                  <span v-if="member.userId === user?.id" class="text-slate-400 dark:text-zinc-500 font-normal">(you)</span>
                </div>
                <div class="text-xs text-slate-500 dark:text-zinc-400 truncate">
                  {{ member.email }}
                  <span v-if="member.position" class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  <span v-if="member.position">{{ member.position }}</span>
                </div>
              </div>

              <!-- Org role badge -->
              <span :class="['text-xs font-medium px-2 py-0.5 rounded-full', getRoleColor(member.orgRole)]">
                {{ member.orgRole }}
              </span>

              <!-- Workspace badges -->
              <div class="flex items-center gap-1 flex-shrink-0">
                <span
                  v-for="ws in member.workspaces.slice(0, 3)"
                  :key="ws.id"
                  class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400 truncate max-w-[80px]"
                  :title="`${ws.name} (${ws.role})`"
                >
                  {{ ws.name }}
                </span>
                <span
                  v-if="member.workspaces.length > 3"
                  class="text-[10px] text-slate-400 dark:text-zinc-500"
                >
                  +{{ member.workspaces.length - 3 }}
                </span>
              </div>
            </div>

            <div v-if="!activeOrgMembers.length" class="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              No active members found
            </div>
          </div>

          <!-- Deactivated section -->
          <div v-if="deactivatedOrgMembers.length" class="mt-4">
            <button
              @click="showDeactivated = !showDeactivated"
              class="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors mb-2"
            >
              <Icon
                :name="showDeactivated ? 'heroicons:chevron-down' : 'heroicons:chevron-right'"
                class="w-4 h-4"
              />
              {{ deactivatedOrgMembers.length }} deactivated {{ deactivatedOrgMembers.length === 1 ? 'member' : 'members' }}
            </button>

            <div v-if="showDeactivated" class="space-y-1">
              <div
                v-for="member in deactivatedOrgMembers"
                :key="member.id"
                class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors opacity-60"
              >
                <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <span class="text-xs font-medium text-slate-400 dark:text-zinc-500">
                    {{ (member.name || member.email)?.[0]?.toUpperCase() || '?' }}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-500 dark:text-zinc-400 truncate">{{ member.name || member.email }}</div>
                  <div class="text-xs text-slate-400 dark:text-zinc-500 truncate">{{ member.email }}</div>
                </div>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 dark:bg-white/[0.08] dark:text-zinc-500">Deactivated</span>
                <span :class="['text-xs font-medium px-2 py-0.5 rounded-full', getRoleColor(member.orgRole)]">
                  {{ member.orgRole }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== USAGE & LIMITS TAB ==================== -->
      <div v-if="activeTab === 'limits'" class="max-w-3xl">
        <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading usage and limits...
        </div>

        <div v-else-if="orgDetails" class="space-y-6">
          <!-- Deployment -->
          <div class="p-5 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100">Deployment</h3>
                <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Self-hosted runtime with configurable limits</p>
              </div>
              <span :class="['text-xs font-semibold px-2.5 py-1 rounded-full', tierColor]">
                {{ tierLabel }}
              </span>
            </div>

            <div class="p-3 bg-slate-50 dark:bg-white/[0.04] rounded-lg border border-slate-100 dark:border-white/[0.06]">
              <p class="text-sm text-slate-700 dark:text-zinc-300">
                This deployment defaults to unlimited plan-style caps. If your admins set environment limits, those values are enforced here.
              </p>
            </div>
          </div>

          <!-- Seat breakdown -->
          <div class="p-5 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100">Seats</h3>
            </div>

            <!-- Internal seats -->
            <div class="mb-5">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:users" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span class="text-sm text-slate-700 dark:text-zinc-300">Internal seats</span>
              </div>
              <template v-if="seatBreakdown(orgDetails.usage?.internalSeats)">
                <div class="text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                  <span class="font-medium text-slate-900 dark:text-zinc-100">{{ seatBreakdown(orgDetails.usage.internalSeats)!.occupied }}</span> occupied
                  <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  <span class="font-medium text-amber-600">{{ seatBreakdown(orgDetails.usage.internalSeats)!.invited }}</span> invited
                  <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  <span class="font-medium text-slate-500 dark:text-zinc-400">{{ seatBreakdown(orgDetails.usage.internalSeats)!.available }}</span> available
                  <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  {{ seatBreakdown(orgDetails.usage.internalSeats)!.total }} total
                </div>
                <div class="h-2.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden flex">
                  <div
                    v-for="(seg, i) in seatBarSegments(seatBreakdown(orgDetails.usage.internalSeats))"
                    :key="i"
                    :class="['h-full transition-all', seg.color]"
                    :style="{ width: `${seg.width}%` }"
                    :title="seg.label"
                  />
                </div>
              </template>
            </div>

            <!-- External seats -->
            <div>
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:user-group" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span class="text-sm text-slate-700 dark:text-zinc-300">External seats</span>
              </div>
              <template v-if="seatBreakdown(orgDetails.usage?.externalSeats)">
                <div class="text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                  <span class="font-medium text-slate-900 dark:text-zinc-100">{{ seatBreakdown(orgDetails.usage.externalSeats)!.occupied }}</span> occupied
                  <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  <span class="font-medium text-amber-600">{{ seatBreakdown(orgDetails.usage.externalSeats)!.invited }}</span> invited
                  <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  <span class="font-medium text-slate-500 dark:text-zinc-400">{{ seatBreakdown(orgDetails.usage.externalSeats)!.available }}</span> available
                  <span class="text-slate-300 dark:text-zinc-600 mx-1">&middot;</span>
                  {{ seatBreakdown(orgDetails.usage.externalSeats)!.total }} total
                </div>
                <div class="h-2.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden flex">
                  <div
                    v-for="(seg, i) in seatBarSegments(seatBreakdown(orgDetails.usage.externalSeats))"
                    :key="i"
                    :class="['h-full transition-all', seg.color]"
                    :style="{ width: `${seg.width}%` }"
                    :title="seg.label"
                  />
                </div>
              </template>
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <div class="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-zinc-100" />
                Occupied
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <div class="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Invited
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <div class="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
                Available
              </div>
            </div>
          </div>

          <!-- Resource usage -->
          <div class="p-5 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100 mb-4">Resource usage</h3>

            <div class="space-y-4">
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:folder" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <span class="text-sm text-slate-700 dark:text-zinc-300">Projects</span>
                  </div>
                  <span class="text-sm text-slate-900 dark:text-zinc-100 font-medium tabular-nums">
                    {{ orgDetails.usage.projects.current }} / {{ formatLimit(orgDetails.usage.projects.limit) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.usage.projects.current, orgDetails.usage.projects.limit)]"
                    :style="{ width: `${usagePercent(orgDetails.usage.projects.current, orgDetails.usage.projects.limit)}%` }"
                  />
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:globe-alt" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <span class="text-sm text-slate-700 dark:text-zinc-300">External spaces</span>
                  </div>
                  <span class="text-sm text-slate-900 dark:text-zinc-100 font-medium tabular-nums">
                    {{ orgDetails.usage.externalSpaces.current }} / {{ formatLimit(orgDetails.usage.externalSpaces.limit) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.usage.externalSpaces.current, orgDetails.usage.externalSpaces.limit)]"
                    :style="{ width: `${usagePercent(orgDetails.usage.externalSpaces.current, orgDetails.usage.externalSpaces.limit)}%` }"
                  />
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:squares-2x2" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <span class="text-sm text-slate-700 dark:text-zinc-300">Workspaces</span>
                  </div>
                  <span class="text-sm text-slate-900 dark:text-zinc-100 font-medium tabular-nums">
                    {{ orgDetails.usage.workspaces.current }} / {{ formatLimit(orgDetails.usage.workspaces.limit) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.usage.workspaces.current, orgDetails.usage.workspaces.limit)]"
                    :style="{ width: `${usagePercent(orgDetails.usage.workspaces.current, orgDetails.usage.workspaces.limit)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- AI Usage -->
          <div class="p-5 bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <h3 class="text-sm font-medium text-slate-900 dark:text-zinc-100 mb-1">Your AI usage this month</h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mb-4">Per-user monthly counters reset on the 1st</p>

            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <Icon name="heroicons:sparkles" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span class="text-sm text-slate-700 dark:text-zinc-300">AI queries used</span>
              </div>
              <span class="text-sm text-slate-900 dark:text-zinc-100 font-medium tabular-nums">
                {{ orgDetails.aiCredits.current.toLocaleString() }} / {{ formatLimit(orgDetails.aiCredits.limit) }}
              </span>
            </div>
            <div class="h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.aiCredits.current, orgDetails.aiCredits.limit)]"
                :style="{ width: `${usagePercent(orgDetails.aiCredits.current, orgDetails.aiCredits.limit)}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
