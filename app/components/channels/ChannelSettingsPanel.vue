<script setup lang="ts">
interface ChannelMember {
  id: string
  userId: string
  role: string
  isExternal: boolean
  muted: boolean
  joinedAt: string
  user: {
    id: string
    name: string | null
    email: string
    avatar: string | null
  }
}

interface WorkspaceMember {
  id: string
  userId: string
  email: string
  name: string | null
  avatar: string | null
  role: string
  status: string
  joinedAt: string
}

const props = defineProps<{
  open: boolean
  channel: any
  currentUserId: string
  workspaceId: string
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

// ── Admin detection ──
const isAdmin = computed(() => {
  if (!props.channel?.members) return false
  const me = props.channel.members.find(
    (m: ChannelMember) => m.userId === props.currentUserId
  )
  return me?.role === 'owner' || me?.role === 'admin'
})

// Project channels: membership managed via project assignees only
const isProjectChannel = computed(() => props.channel?.type === 'project')

// ── Channel info editing ──
const editedDisplayName = ref('')
const editedDescription = ref('')
const savingInfo = ref(false)
const infoError = ref('')
const infoSuccess = ref(false)

watch(
  () => [props.open, props.channel?.id],
  () => {
    if (props.open && props.channel) {
      editedDisplayName.value = props.channel.displayName || ''
      editedDescription.value = props.channel.description || ''
      infoError.value = ''
      infoSuccess.value = false
      addMemberError.value = ''
      memberSearch.value = ''
      showMemberDropdown.value = false
    }
  },
  { immediate: true }
)

const handleSaveInfo = async (field: 'displayName' | 'description') => {
  if (!isAdmin.value || savingInfo.value) return

  const body: Record<string, string> = {}
  if (field === 'displayName') {
    const trimmed = editedDisplayName.value.trim()
    if (trimmed === (props.channel.displayName || '')) return
    body.displayName = trimmed
  } else {
    const trimmed = editedDescription.value.trim()
    if (trimmed === (props.channel.description || '')) return
    body.description = trimmed
  }

  savingInfo.value = true
  infoError.value = ''
  infoSuccess.value = false

  try {
    await $fetch(`/api/channels/${props.channel.id}`, {
      method: 'PATCH',
      body,
    })
    infoSuccess.value = true
    setTimeout(() => { infoSuccess.value = false }, 2000)
    emit('updated')
  } catch (e: any) {
    infoError.value = e?.data?.message || e?.message || 'Failed to update channel'
  } finally {
    savingInfo.value = false
  }
}

// ── Member management ──
const memberActionLoading = ref<string | null>(null)
const memberError = ref('')

const roleOptions = ['owner', 'admin', 'member', 'guest'] as const
const roleDropdownOpen = ref<string | null>(null)

const toggleRoleDropdown = (memberId: string) => {
  roleDropdownOpen.value = roleDropdownOpen.value === memberId ? null : memberId
}

const selectRole = (member: ChannelMember, role: string) => {
  roleDropdownOpen.value = null
  handleChangeRole(member, role)
}

const roleBadgeClass = (role: string) => {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
    case 'admin':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
    case 'guest':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'
  }
}

const handleChangeRole = async (member: ChannelMember, newRole: string) => {
  if (newRole === member.role) return
  memberActionLoading.value = member.userId
  memberError.value = ''

  try {
    await $fetch(`/api/channels/${props.channel.id}/members/${member.userId}`, {
      method: 'PATCH',
      body: { role: newRole.toUpperCase() },
    })
    emit('updated')
  } catch (e: any) {
    memberError.value = e?.data?.message || e?.statusMessage || 'Failed to change role'
  } finally {
    memberActionLoading.value = null
  }
}

const handleRemoveMember = async (member: ChannelMember) => {
  memberActionLoading.value = member.userId
  memberError.value = ''

  try {
    await $fetch(`/api/channels/${props.channel.id}/members/${member.userId}`, {
      method: 'DELETE',
    })
    emit('updated')
  } catch (e: any) {
    memberError.value = e?.data?.message || e?.statusMessage || 'Failed to remove member'
  } finally {
    memberActionLoading.value = null
  }
}

// ── Add member ──
const memberSearch = ref('')
const showMemberDropdown = ref(false)
const workspaceMembers = ref<WorkspaceMember[]>([])
const loadingWorkspaceMembers = ref(false)
const addMemberError = ref('')
const addingMemberId = ref<string | null>(null)

const fetchWorkspaceMembers = async () => {
  if (workspaceMembers.value.length > 0) return
  loadingWorkspaceMembers.value = true
  try {
    const data = await $fetch<WorkspaceMember[]>(
      `/api/workspaces/${props.workspaceId}/members`
    )
    workspaceMembers.value = Array.isArray(data) ? data : []
  } catch (e: any) {
    console.error('Failed to fetch workspace members:', e)
  } finally {
    loadingWorkspaceMembers.value = false
  }
}

const availableMembers = computed(() => {
  const channelUserIds = new Set(
    (props.channel?.members || []).map((m: ChannelMember) => m.userId)
  )
  const search = memberSearch.value.toLowerCase().trim()
  return workspaceMembers.value.filter((wm) => {
    if (channelUserIds.has(wm.userId)) return false
    if (!search) return true
    return (
      (wm.name?.toLowerCase().includes(search)) ||
      wm.email.toLowerCase().includes(search)
    )
  })
})

const handleFocusSearch = () => {
  fetchWorkspaceMembers()
  showMemberDropdown.value = true
}

const handleAddMember = async (wm: WorkspaceMember) => {
  addingMemberId.value = wm.userId
  addMemberError.value = ''

  try {
    await $fetch(`/api/channels/${props.channel.id}/members`, {
      method: 'POST',
      body: { userId: wm.userId },
    })
    memberSearch.value = ''
    showMemberDropdown.value = false
    emit('updated')
  } catch (e: any) {
    addMemberError.value = e?.data?.message || e?.statusMessage || 'Failed to add member'
  } finally {
    addingMemberId.value = null
  }
}

// ── Close on Escape ──
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// ── Close dropdown on click outside ──
const addMemberRef = ref<HTMLElement | null>(null)

const handleClickOutsideDropdown = (e: MouseEvent) => {
  if (addMemberRef.value && !addMemberRef.value.contains(e.target as Node)) {
    showMemberDropdown.value = false
  }
  // Close role dropdown if clicking outside
  if (roleDropdownOpen.value) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-role-dropdown]')) {
      roleDropdownOpen.value = null
    }
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutsideDropdown))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutsideDropdown))

// ── Reset workspace members cache when panel reopens ──
watch(
  () => props.open,
  (open) => {
    if (open) {
      workspaceMembers.value = []
    }
  }
)

// ── Helpers ──
const getInitial = (name: string | null, email: string) => {
  return (name || email || '?').charAt(0).toUpperCase()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-panel">
      <div v-if="open" class="fixed inset-0 z-50 flex justify-end">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40"
          @click="emit('close')"
        />

        <!-- Panel -->
        <div class="panel relative bg-white dark:bg-dm-card w-full max-w-sm h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-white/[0.06]">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                {{ channel?.displayName || channel?.name || 'Channel Settings' }}
              </h2>
              <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Settings</p>
            </div>
            <button
              @click="emit('close')"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto">
            <!-- Channel Info Section -->
            <div class="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 class="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                Channel Info
              </h3>

              <div class="space-y-3">
                <!-- Display Name -->
                <div>
                  <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                    Name
                  </label>
                  <input
                    v-model="editedDisplayName"
                    type="text"
                    maxlength="80"
                    :disabled="!isAdmin"
                    :class="[
                      'w-full px-3 py-2 text-sm border rounded-lg transition-all',
                      isAdmin
                        ? 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30'
                        : 'border-slate-100 dark:border-white/[0.04] bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-500 cursor-not-allowed'
                    ]"
                    @blur="handleSaveInfo('displayName')"
                    @keydown.enter="($event.target as HTMLInputElement)?.blur()"
                  />
                </div>

                <!-- Description -->
                <div>
                  <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                    Description
                  </label>
                  <textarea
                    v-model="editedDescription"
                    rows="2"
                    maxlength="500"
                    :disabled="!isAdmin"
                    placeholder="What's this channel about?"
                    :class="[
                      'w-full px-3 py-2 text-sm border rounded-lg transition-all resize-none',
                      isAdmin
                        ? 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30'
                        : 'border-slate-100 dark:border-white/[0.04] bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-500 placeholder-slate-300 dark:placeholder-zinc-700 cursor-not-allowed'
                    ]"
                    @blur="handleSaveInfo('description')"
                  />
                </div>

                <!-- Save feedback -->
                <div class="flex items-center gap-2 min-h-[20px]">
                  <span v-if="savingInfo" class="text-xs text-slate-400 dark:text-zinc-500">
                    Saving...
                  </span>
                  <span v-else-if="infoSuccess" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Saved
                  </span>
                  <span v-else-if="infoError" class="text-xs text-rose-600 dark:text-rose-400">
                    {{ infoError }}
                  </span>
                </div>

                <!-- Channel metadata -->
                <div class="flex items-center gap-3 text-xs text-slate-400 dark:text-zinc-500">
                  <span v-if="channel?.type" class="flex items-center gap-1">
                    <Icon
                      :name="channel.type === 'project' ? 'heroicons:folder' : channel.type === 'workspace' ? 'heroicons:building-office' : 'heroicons:hashtag'"
                      class="w-3.5 h-3.5"
                    />
                    {{ channel.type }}
                  </span>
                  <span v-if="channel?.visibility" class="flex items-center gap-1">
                    <Icon
                      :name="channel.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:globe-alt'"
                      class="w-3.5 h-3.5"
                    />
                    {{ channel.visibility }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Members Section -->
            <div class="px-5 py-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  Members
                  <span v-if="channel?.members" class="font-normal">
                    ({{ channel.members.length }})
                  </span>
                </h3>
              </div>

              <!-- Member error -->
              <div
                v-if="memberError"
                class="mb-3 p-2.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg"
              >
                {{ memberError }}
              </div>

              <!-- Project channel note -->
              <p
                v-if="isProjectChannel"
                class="mb-3 text-xs text-slate-400 dark:text-zinc-500 leading-relaxed"
              >
                Members are managed through project assignments. Add or remove assignees from the project to update this channel's members.
              </p>

              <!-- Add member (admin only, non-project channels) -->
              <div v-if="isAdmin && !isProjectChannel" ref="addMemberRef" class="mb-4 relative">
                <div class="relative">
                  <Icon
                    name="heroicons:magnifying-glass"
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500"
                  />
                  <input
                    v-model="memberSearch"
                    type="text"
                    placeholder="Add a member..."
                    class="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30 transition-all"
                    @focus="handleFocusSearch"
                    @input="showMemberDropdown = true"
                  />
                </div>

                <!-- Add member error -->
                <p v-if="addMemberError" class="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {{ addMemberError }}
                </p>

                <!-- Dropdown -->
                <div
                  v-if="showMemberDropdown"
                  class="absolute left-0 right-0 mt-1 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-lg max-h-48 overflow-y-auto z-10"
                >
                  <!-- Loading -->
                  <div
                    v-if="loadingWorkspaceMembers"
                    class="flex items-center justify-center py-4"
                  >
                    <Icon name="heroicons:arrow-path" class="w-4 h-4 text-slate-400 dark:text-zinc-500 animate-spin" />
                  </div>

                  <!-- Results -->
                  <template v-else>
                    <button
                      v-for="wm in availableMembers"
                      :key="wm.userId"
                      :disabled="addingMemberId === wm.userId"
                      class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                      @click="handleAddMember(wm)"
                    >
                      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 dark:from-zinc-500 dark:to-zinc-700 flex items-center justify-center flex-shrink-0">
                        <span class="text-xs font-medium text-white">{{ getInitial(wm.name, wm.email) }}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm text-slate-900 dark:text-zinc-200 truncate">{{ wm.name || 'Unnamed' }}</div>
                        <div class="text-xs text-slate-400 dark:text-zinc-500 truncate">{{ wm.email }}</div>
                      </div>
                      <Icon
                        v-if="addingMemberId === wm.userId"
                        name="heroicons:arrow-path"
                        class="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0"
                      />
                      <Icon
                        v-else
                        name="heroicons:plus"
                        class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 flex-shrink-0"
                      />
                    </button>

                    <!-- Empty -->
                    <div
                      v-if="availableMembers.length === 0"
                      class="px-3 py-4 text-center text-xs text-slate-400 dark:text-zinc-500"
                    >
                      {{ memberSearch.trim() ? 'No matching members found' : 'All workspace members are in this channel' }}
                    </div>
                  </template>
                </div>
              </div>

              <!-- Member list -->
              <div class="space-y-1">
                <div
                  v-for="member in (channel?.members || [])"
                  :key="member.id"
                  class="flex items-center gap-3 px-2 py-2 rounded-lg group hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <!-- Avatar -->
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 dark:from-zinc-500 dark:to-zinc-700 flex items-center justify-center flex-shrink-0">
                    <span class="text-xs font-medium text-white">{{ getInitial(member.user.name, member.user.email) }}</span>
                  </div>

                  <!-- Info -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-slate-900 dark:text-zinc-200 truncate">
                        {{ member.user.name || 'Unnamed' }}
                      </span>
                      <span
                        v-if="member.userId === currentUserId"
                        class="text-[10px] text-slate-400 dark:text-zinc-500"
                      >
                        you
                      </span>
                    </div>
                    <div class="text-xs text-slate-400 dark:text-zinc-500 truncate">
                      {{ member.user.email }}
                    </div>
                  </div>

                  <!-- Role badge / dropdown + remove -->
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <!-- Custom role dropdown (admin only, not self, non-project channels) -->
                    <div
                      v-if="isAdmin && member.userId !== currentUserId && !isProjectChannel"
                      class="relative"
                      data-role-dropdown
                    >
                      <button
                        :disabled="memberActionLoading === member.userId"
                        class="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors hover:opacity-80 disabled:opacity-50"
                        :class="roleBadgeClass(member.role)"
                        @click="toggleRoleDropdown(member.userId)"
                      >
                        {{ member.role.charAt(0).toUpperCase() + member.role.slice(1) }}
                        <Icon name="heroicons:chevron-down" class="w-3 h-3" />
                      </button>
                      <!-- Dropdown menu -->
                      <Transition
                        enter-active-class="transition duration-100 ease-out"
                        enter-from-class="opacity-0 scale-95"
                        enter-to-class="opacity-100 scale-100"
                        leave-active-class="transition duration-75 ease-in"
                        leave-from-class="opacity-100 scale-100"
                        leave-to-class="opacity-0 scale-95"
                      >
                        <div
                          v-if="roleDropdownOpen === member.userId"
                          class="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-lg overflow-hidden z-20"
                        >
                          <button
                            v-for="role in roleOptions"
                            :key="role"
                            class="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between"
                            :class="member.role === role
                              ? 'bg-slate-50 dark:bg-white/[0.06] font-medium text-slate-900 dark:text-zinc-100'
                              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'"
                            @click="selectRole(member, role)"
                          >
                            {{ role.charAt(0).toUpperCase() + role.slice(1) }}
                            <Icon v-if="member.role === role" name="heroicons:check" class="w-3.5 h-3.5 text-emerald-500" />
                          </button>
                        </div>
                      </Transition>
                    </div>

                    <!-- Static role badge (non-admin or self) -->
                    <span
                      v-else
                      class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      :class="roleBadgeClass(member.role)"
                    >
                      {{ member.role.charAt(0).toUpperCase() + member.role.slice(1) }}
                    </span>

                    <!-- Remove button (admin only, not self, non-project channels) — always visible -->
                    <button
                      v-if="isAdmin && member.userId !== currentUserId && !isProjectChannel"
                      :disabled="memberActionLoading === member.userId"
                      class="p-1 rounded text-slate-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      title="Remove member"
                      @click="handleRemoveMember(member)"
                    >
                      <Icon
                        v-if="memberActionLoading === member.userId"
                        name="heroicons:arrow-path"
                        class="w-3.5 h-3.5 animate-spin"
                      />
                      <Icon v-else name="heroicons:trash" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Empty members state -->
                <div
                  v-if="!channel?.members?.length"
                  class="px-2 py-6 text-center text-sm text-slate-400 dark:text-zinc-500"
                >
                  No members yet.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-panel-enter-active,
.settings-panel-leave-active {
  transition: opacity 0.2s ease;
}

.settings-panel-enter-from,
.settings-panel-leave-to {
  opacity: 0;
}

.settings-panel-enter-active .panel,
.settings-panel-leave-active .panel {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.settings-panel-enter-from .panel,
.settings-panel-leave-to .panel {
  transform: translateX(100%);
  opacity: 0;
}
</style>
