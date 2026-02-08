<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
  middleware: 'auth',
})

const router = useRouter()
const { user } = useAuth()
const { isOrgAdmin, currentWorkspace, switchWorkspace } = useWorkspaces()
const { calculateSeatCost } = usePricing()
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

const activeTab = ref<'overview' | 'workspaces' | 'members' | 'plan'>('overview')

// Editing state
const editingName = ref(false)
const editName = ref('')
const editingEmail = ref(false)
const editEmail = ref('')
const saving = ref(false)
const saveSuccess = ref(false)

// Members state
const showDeactivated = ref(false)

// Plan modals
const showUpgradeToProModal = ref(false)
const showBuySeats = ref(false)

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
  return 'bg-slate-900'
}

const tierLabel = computed(() => {
  const tier = orgDetails.value?.planTier
  if (tier === 'PRO') return 'Pro'
  if (tier === 'ENTERPRISE') return 'Enterprise'
  return 'Free'
})

const tierColor = computed(() => {
  const tier = orgDetails.value?.planTier
  if (tier === 'PRO') return 'bg-blue-100 text-blue-700'
  if (tier === 'ENTERPRISE') return 'bg-violet-100 text-violet-700'
  return 'bg-slate-100 text-slate-600'
})

const getRoleColor = (role: string) => {
  switch (role) {
    case 'OWNER': return 'bg-amber-100 text-amber-700'
    case 'ADMIN': return 'bg-blue-100 text-blue-700'
    case 'MEMBER': return 'bg-slate-100 text-slate-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

const totalInternalSeats = computed(() => orgDetails.value?.usage?.internalSeats?.total ?? 0)
const totalExternalSeats = computed(() => orgDetails.value?.usage?.externalSeats?.total ?? 0)
const proCostInternal = computed(() => calculateSeatCost(totalInternalSeats.value, 'INTERNAL'))
const proCostExternal = computed(() => calculateSeatCost(totalExternalSeats.value, 'EXTERNAL'))
const proCostTotal = computed(() => proCostInternal.value + proCostExternal.value)
const occupiedInternal = computed(() => orgDetails.value?.usage?.internalSeats?.occupied ?? 0)
const occupiedExternal = computed(() => orgDetails.value?.usage?.externalSeats?.occupied ?? 0)

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
    { width: (data.occupied / total) * 100, color: 'bg-slate-900', label: 'Occupied' },
    { width: (data.invited / total) * 100, color: 'bg-amber-400', label: 'Invited' },
    { width: (data.available / total) * 100, color: 'bg-slate-200', label: 'Available' },
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
  { key: 'plan', label: 'Plan & Billing', icon: 'heroicons:credit-card' },
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
      <h1 class="text-xl font-medium text-slate-900">Organization</h1>
      <p class="text-sm text-slate-500 mt-0.5">Manage your organization settings, members, and billing</p>
    </header>

    <div class="flex-1 overflow-auto px-6 pb-6">
      <!-- Tabs -->
      <div class="flex gap-1 mb-6 border-b border-slate-200">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key as typeof activeTab"
          :class="[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === tab.key
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          ]"
        >
          <Icon :name="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </div>

      <!-- ==================== OVERVIEW TAB ==================== -->
      <div v-if="activeTab === 'overview'" class="max-w-3xl">
        <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading organization...
        </div>

        <div v-else-if="orgDetails" class="space-y-6">
          <!-- Org info card -->
          <div class="p-5 bg-white rounded-xl border border-slate-200">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-slate-900">Organization details</h3>
              <span :class="['text-xs font-semibold px-2.5 py-1 rounded-full', tierColor]">
                {{ tierLabel }}
              </span>
            </div>

            <div class="space-y-4">
              <!-- Name -->
              <div>
                <label class="block text-xs text-slate-500 mb-1">Name</label>
                <div v-if="!editingName" class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900">{{ orgDetails.name }}</span>
                  <button
                    v-if="isOrgOwner"
                    @click="startEditName"
                    class="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded"
                  >
                    <Icon name="heroicons:pencil" class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <input
                    v-model="editName"
                    type="text"
                    maxlength="255"
                    class="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                    @keydown.enter="saveName"
                    @keydown.escape="editingName = false"
                  />
                  <button
                    @click="saveName"
                    :disabled="saving"
                    class="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    @click="editingName = false"
                    class="px-3 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Slug -->
              <div>
                <label class="block text-xs text-slate-500 mb-1">Slug</label>
                <span class="text-sm text-slate-700">{{ orgDetails.slug }}</span>
              </div>

              <!-- Billing email -->
              <div>
                <label class="block text-xs text-slate-500 mb-1">Billing email</label>
                <div v-if="!editingEmail" class="flex items-center gap-2">
                  <span class="text-sm text-slate-700">{{ orgDetails.billingEmail || 'Not set' }}</span>
                  <button
                    @click="startEditEmail"
                    class="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded"
                  >
                    <Icon name="heroicons:pencil" class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <input
                    v-model="editEmail"
                    type="email"
                    placeholder="billing@company.com"
                    class="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                    @keydown.enter="saveEmail"
                    @keydown.escape="editingEmail = false"
                  />
                  <button
                    @click="saveEmail"
                    :disabled="saving"
                    class="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    @click="editingEmail = false"
                    class="px-3 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Created -->
              <div>
                <label class="block text-xs text-slate-500 mb-1">Created</label>
                <span class="text-sm text-slate-700">{{ new Date(orgDetails.createdAt).toLocaleDateString() }}</span>
              </div>
            </div>

            <span v-if="saveSuccess" class="text-xs text-emerald-600 flex items-center gap-1 mt-3">
              <Icon name="heroicons:check" class="w-3.5 h-3.5" />
              Saved
            </span>
          </div>

          <!-- Quick stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 bg-white rounded-xl border border-slate-200">
              <div class="text-2xl font-semibold text-slate-900 tabular-nums">{{ totalMembers }}</div>
              <div class="text-xs text-slate-500 mt-1">Active members</div>
            </div>
            <div class="p-4 bg-white rounded-xl border border-slate-200">
              <div class="text-2xl font-semibold text-slate-900 tabular-nums">{{ totalWorkspaces }}</div>
              <div class="text-xs text-slate-500 mt-1">Workspaces</div>
            </div>
            <div class="p-4 bg-white rounded-xl border border-slate-200">
              <div class="text-2xl font-semibold text-slate-900 tabular-nums">{{ totalSeatsUsed }} / {{ totalSeatsAvailable }}</div>
              <div class="text-xs text-slate-500 mt-1">Seats used</div>
            </div>
            <div class="p-4 bg-white rounded-xl border border-slate-200">
              <div class="text-2xl font-semibold text-slate-900 tabular-nums">{{ totalProjects }}</div>
              <div class="text-xs text-slate-500 mt-1">Projects</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== WORKSPACES TAB ==================== -->
      <div v-if="activeTab === 'workspaces'" class="max-w-3xl">
        <div v-if="workspacesLoading" class="flex items-center gap-2 text-sm text-slate-500 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading workspaces...
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="ws in orgWorkspaces"
            :key="ws.id"
            @click="handleWorkspaceClick(ws.id)"
            class="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-medium text-slate-900 truncate">{{ ws.name }}</h3>
                  <span
                    v-if="currentWorkspace?.id === ws.id"
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
                  >
                    Current
                  </span>
                </div>
                <p v-if="ws.description" class="text-xs text-slate-500 mt-0.5 truncate">{{ ws.description }}</p>
              </div>
              <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
            <div class="flex items-center gap-4 mt-3 text-xs text-slate-500">
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
              <span class="text-slate-400">
                Created {{ new Date(ws.createdAt).toLocaleDateString() }}
              </span>
            </div>
          </div>

          <div v-if="!orgWorkspaces.length" class="py-12 text-center">
            <Icon name="heroicons:squares-2x2" class="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p class="text-sm text-slate-500">No workspaces yet</p>
          </div>
        </div>
      </div>

      <!-- ==================== MEMBERS TAB ==================== -->
      <div v-if="activeTab === 'members'" class="max-w-3xl">
        <!-- Pending invites -->
        <div v-if="pendingInvites.length" class="mb-6 p-4 bg-white rounded-xl border border-slate-200">
          <h3 class="text-sm font-medium text-slate-900 mb-3">
            Pending invites
            <span class="text-slate-400 font-normal">({{ pendingInvites.length }})</span>
          </h3>
          <div class="space-y-2">
            <div
              v-for="inv in pendingInvites"
              :key="inv.id"
              class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50"
            >
              <div class="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Icon name="heroicons:envelope" class="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-900 truncate">{{ inv.email }}</div>
                <div class="text-xs text-slate-400">
                  {{ inv.role }} &middot; {{ formatExpiry(inv.expiresAt) }}
                  <span v-if="inv.workspace"> &middot; {{ inv.workspace.name }}</span>
                </div>
              </div>
              <button
                @click="handleCancelInvite(inv.id)"
                :disabled="cancellingInvite === inv.id"
                class="text-xs px-2 py-0.5 text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                {{ cancellingInvite === inv.id ? '...' : 'Cancel' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="membersLoading" class="flex items-center gap-2 text-sm text-slate-500 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading members...
        </div>

        <div v-else class="space-y-4">
          <!-- Active members -->
          <div class="space-y-1">
            <div
              v-for="member in activeOrgMembers"
              :key="member.id"
              class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <span class="text-xs font-medium text-slate-600">
                  {{ (member.name || member.email)?.[0]?.toUpperCase() || '?' }}
                </span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900 truncate">
                  {{ member.name || member.email }}
                  <span v-if="member.userId === user?.id" class="text-slate-400 font-normal">(you)</span>
                </div>
                <div class="text-xs text-slate-500 truncate">
                  {{ member.email }}
                  <span v-if="member.position" class="text-slate-300 mx-1">&middot;</span>
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
                  class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[80px]"
                  :title="`${ws.name} (${ws.role})`"
                >
                  {{ ws.name }}
                </span>
                <span
                  v-if="member.workspaces.length > 3"
                  class="text-[10px] text-slate-400"
                >
                  +{{ member.workspaces.length - 3 }}
                </span>
              </div>
            </div>

            <div v-if="!activeOrgMembers.length" class="py-8 text-center text-sm text-slate-500">
              No active members found
            </div>
          </div>

          <!-- Deactivated section -->
          <div v-if="deactivatedOrgMembers.length" class="mt-4">
            <button
              @click="showDeactivated = !showDeactivated"
              class="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-2"
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
                class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors opacity-60"
              >
                <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <span class="text-xs font-medium text-slate-400">
                    {{ (member.name || member.email)?.[0]?.toUpperCase() || '?' }}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-500 truncate">{{ member.name || member.email }}</div>
                  <div class="text-xs text-slate-400 truncate">{{ member.email }}</div>
                </div>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Deactivated</span>
                <span :class="['text-xs font-medium px-2 py-0.5 rounded-full', getRoleColor(member.orgRole)]">
                  {{ member.orgRole }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== PLAN & BILLING TAB ==================== -->
      <div v-if="activeTab === 'plan'" class="max-w-3xl">
        <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 py-8">
          <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
          Loading plan details...
        </div>

        <div v-else-if="orgDetails" class="space-y-6">
          <!-- Current plan -->
          <div class="p-5 bg-white rounded-xl border border-slate-200">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-medium text-slate-900">Current plan</h3>
                <p class="text-xs text-slate-500 mt-0.5">Manage your organization's plan and resource usage</p>
              </div>
              <span :class="['text-xs font-semibold px-2.5 py-1 rounded-full', tierColor]">
                {{ tierLabel }}
              </span>
            </div>

            <div v-if="orgDetails.planTier === 'FREE'" class="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p class="text-sm text-slate-700">
                You're on the <strong>Free</strong> plan. Upgrade to <strong>Pro</strong> for more seats, projects, and 10,000 AI credits/user/mo.
              </p>
              <button
                v-if="isOrgOwner"
                @click="showUpgradeToProModal = true"
                class="mt-2 text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700 transition-colors"
              >
                Upgrade to Pro — from $5/seat/mo
              </button>
            </div>

            <div v-else-if="orgDetails.planTier === 'PRO'" class="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p class="text-sm text-blue-800">
                You're on the <strong>Pro</strong> plan.
              </p>
              <p class="text-xs text-blue-700 mt-1">
                {{ totalInternalSeats }} internal (${{ proCostInternal }}/mo) &middot; {{ totalExternalSeats }} external (${{ proCostExternal }}/mo) &middot; <strong>Total: ${{ proCostTotal }}/mo</strong>
              </p>
            </div>

            <div v-else class="p-3 bg-violet-50 rounded-lg border border-violet-100">
              <p class="text-sm text-violet-800">
                You're on the <strong>Enterprise</strong> plan with custom limits.
              </p>
            </div>
          </div>

          <!-- Seat breakdown -->
          <div class="p-5 bg-white rounded-xl border border-slate-200">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-slate-900">Seats</h3>
              <button
                v-if="isOrgOwner && orgDetails.planTier !== 'FREE'"
                @click="showBuySeats = true"
                class="text-xs font-medium text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Purchase more
              </button>
            </div>

            <!-- Internal seats -->
            <div class="mb-5">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:users" class="w-4 h-4 text-slate-400" />
                <span class="text-sm text-slate-700">Internal seats</span>
              </div>
              <template v-if="seatBreakdown(orgDetails.usage?.internalSeats)">
                <div class="text-xs text-slate-500 mb-1.5">
                  <span class="font-medium text-slate-900">{{ seatBreakdown(orgDetails.usage.internalSeats)!.occupied }}</span> occupied
                  <span class="text-slate-300 mx-1">&middot;</span>
                  <span class="font-medium text-amber-600">{{ seatBreakdown(orgDetails.usage.internalSeats)!.invited }}</span> invited
                  <span class="text-slate-300 mx-1">&middot;</span>
                  <span class="font-medium text-slate-500">{{ seatBreakdown(orgDetails.usage.internalSeats)!.available }}</span> available
                  <span class="text-slate-300 mx-1">&middot;</span>
                  {{ seatBreakdown(orgDetails.usage.internalSeats)!.total }} total
                </div>
                <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
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
                <Icon name="heroicons:user-group" class="w-4 h-4 text-slate-400" />
                <span class="text-sm text-slate-700">External seats</span>
              </div>
              <template v-if="seatBreakdown(orgDetails.usage?.externalSeats)">
                <div class="text-xs text-slate-500 mb-1.5">
                  <span class="font-medium text-slate-900">{{ seatBreakdown(orgDetails.usage.externalSeats)!.occupied }}</span> occupied
                  <span class="text-slate-300 mx-1">&middot;</span>
                  <span class="font-medium text-amber-600">{{ seatBreakdown(orgDetails.usage.externalSeats)!.invited }}</span> invited
                  <span class="text-slate-300 mx-1">&middot;</span>
                  <span class="font-medium text-slate-500">{{ seatBreakdown(orgDetails.usage.externalSeats)!.available }}</span> available
                  <span class="text-slate-300 mx-1">&middot;</span>
                  {{ seatBreakdown(orgDetails.usage.externalSeats)!.total }} total
                </div>
                <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
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
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <div class="w-2.5 h-2.5 rounded-full bg-slate-900" />
                Occupied
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <div class="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Invited
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <div class="w-2.5 h-2.5 rounded-full bg-slate-200" />
                Available
              </div>
            </div>
          </div>

          <!-- Resource usage -->
          <div class="p-5 bg-white rounded-xl border border-slate-200">
            <h3 class="text-sm font-medium text-slate-900 mb-4">Resource usage</h3>

            <div class="space-y-4">
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:folder" class="w-4 h-4 text-slate-400" />
                    <span class="text-sm text-slate-700">Projects</span>
                  </div>
                  <span class="text-sm text-slate-900 font-medium tabular-nums">
                    {{ orgDetails.usage.projects.current }} / {{ formatLimit(orgDetails.usage.projects.limit) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.usage.projects.current, orgDetails.usage.projects.limit)]"
                    :style="{ width: `${usagePercent(orgDetails.usage.projects.current, orgDetails.usage.projects.limit)}%` }"
                  />
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:globe-alt" class="w-4 h-4 text-slate-400" />
                    <span class="text-sm text-slate-700">External spaces</span>
                  </div>
                  <span class="text-sm text-slate-900 font-medium tabular-nums">
                    {{ orgDetails.usage.externalSpaces.current }} / {{ formatLimit(orgDetails.usage.externalSpaces.limit) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.usage.externalSpaces.current, orgDetails.usage.externalSpaces.limit)]"
                    :style="{ width: `${usagePercent(orgDetails.usage.externalSpaces.current, orgDetails.usage.externalSpaces.limit)}%` }"
                  />
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:squares-2x2" class="w-4 h-4 text-slate-400" />
                    <span class="text-sm text-slate-700">Workspaces</span>
                  </div>
                  <span class="text-sm text-slate-900 font-medium tabular-nums">
                    {{ orgDetails.usage.workspaces.current }} / {{ formatLimit(orgDetails.usage.workspaces.limit) }}
                  </span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.usage.workspaces.current, orgDetails.usage.workspaces.limit)]"
                    :style="{ width: `${usagePercent(orgDetails.usage.workspaces.current, orgDetails.usage.workspaces.limit)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- AI Credits -->
          <div class="p-5 bg-white rounded-xl border border-slate-200">
            <h3 class="text-sm font-medium text-slate-900 mb-1">Your AI credits this month</h3>
            <p class="text-xs text-slate-500 mb-4">AI credits are tracked per user per month and reset on the 1st</p>

            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <Icon name="heroicons:sparkles" class="w-4 h-4 text-slate-400" />
                <span class="text-sm text-slate-700">AI credits used</span>
              </div>
              <span class="text-sm text-slate-900 font-medium tabular-nums">
                {{ orgDetails.aiCredits.current.toLocaleString() }} / {{ formatLimit(orgDetails.aiCredits.limit) }}
              </span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                :class="['h-full rounded-full transition-all', usageBarColor(orgDetails.aiCredits.current, orgDetails.aiCredits.limit)]"
                :style="{ width: `${usagePercent(orgDetails.aiCredits.current, orgDetails.aiCredits.limit)}%` }"
              />
            </div>
          </div>

          <!-- Plan comparison -->
          <div v-if="orgDetails.planTier !== 'ENTERPRISE'" class="p-5 bg-white rounded-xl border border-slate-200">
            <h3 class="text-sm font-medium text-slate-900 mb-4">Compare plans</h3>

            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100">
                  <th class="text-left py-2 text-slate-500 font-normal">Feature</th>
                  <th class="text-center py-2 text-slate-500 font-normal">Free</th>
                  <th class="text-center py-2 text-slate-900 font-medium">Pro</th>
                  <th class="text-center py-2 text-slate-500 font-normal">Enterprise</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr>
                  <td class="py-2 text-slate-700">Internal seats</td>
                  <td class="py-2 text-center text-slate-500">5</td>
                  <td class="py-2 text-center text-slate-900 font-medium">Up to 100</td>
                  <td class="py-2 text-center text-slate-500">Unlimited</td>
                </tr>
                <tr>
                  <td class="py-2 text-slate-700">External seats</td>
                  <td class="py-2 text-center text-slate-500">3</td>
                  <td class="py-2 text-center text-slate-900 font-medium">Up to 100</td>
                  <td class="py-2 text-center text-slate-500">Unlimited</td>
                </tr>
                <tr>
                  <td class="py-2 text-slate-700">Pricing</td>
                  <td class="py-2 text-center text-slate-500">Free</td>
                  <td class="py-2 text-center text-slate-900 font-medium">From $5/seat</td>
                  <td class="py-2 text-center text-slate-500">Custom</td>
                </tr>
                <tr>
                  <td class="py-2 text-slate-700">Projects</td>
                  <td class="py-2 text-center text-slate-500">1</td>
                  <td class="py-2 text-center text-slate-900 font-medium">25</td>
                  <td class="py-2 text-center text-slate-500">Unlimited</td>
                </tr>
                <tr>
                  <td class="py-2 text-slate-700">External spaces</td>
                  <td class="py-2 text-center text-slate-500">1</td>
                  <td class="py-2 text-center text-slate-900 font-medium">25</td>
                  <td class="py-2 text-center text-slate-500">Unlimited</td>
                </tr>
                <tr>
                  <td class="py-2 text-slate-700">AI credits / user / mo</td>
                  <td class="py-2 text-center text-slate-500">100</td>
                  <td class="py-2 text-center text-slate-900 font-medium">10,000</td>
                  <td class="py-2 text-center text-slate-500">Custom</td>
                </tr>
              </tbody>
            </table>

            <div v-if="orgDetails.planTier === 'FREE' && isOrgOwner" class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <p class="text-sm text-slate-500">Need more room to grow?</p>
              <button
                @click="showUpgradeToProModal = true"
                class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UpgradeToProModal
      :open="showUpgradeToProModal"
      :occupied-internal="occupiedInternal"
      :occupied-external="occupiedExternal"
      :organization-id="organizationId"
      @close="showUpgradeToProModal = false"
      @upgraded="fetchOrgDetails()"
    />

    <BuySeatsModal
      :open="showBuySeats"
      :plan-tier="orgDetails?.planTier"
      :current-internal="totalInternalSeats"
      :current-external="totalExternalSeats"
      :organization-id="organizationId"
      @close="showBuySeats = false"
      @purchased="fetchOrgDetails()"
    />
  </div>
</template>
