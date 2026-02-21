<script setup lang="ts">
const emit = defineEmits<{
  close: []
}>()

const { logout } = useAuth()
const { currentWorkspace, currentRole, membership } = useWorkspaces()

// Fetch full profile
const profile = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

// Editable fields
const editedName = ref('')
const editedPosition = ref('')

const fetchProfile = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/users/me')
    profile.value = data
    editedName.value = data.name || ''
    editedPosition.value = data.position || ''
  } catch (e) {
    console.error('Failed to fetch profile:', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchProfile)

const hasChanges = computed(() => {
  if (!profile.value) return false
  return (
    editedName.value.trim() !== (profile.value.name || '') ||
    editedPosition.value.trim() !== (profile.value.position || '')
  )
})

const canSave = computed(() =>
  hasChanges.value && editedName.value.trim().length >= 1 && !saving.value
)

const handleSave = async () => {
  if (!canSave.value) return

  saving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    const updated = await $fetch('/api/users/me', {
      method: 'PATCH',
      body: {
        name: editedName.value.trim(),
        position: editedPosition.value.trim(),
      },
    })
    profile.value = { ...profile.value, ...updated }
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (e: any) {
    saveError.value = e?.data?.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

const handleLogout = async () => {
  await logout()
  emit('close')
}

const roleLabel = (role: string | null) => {
  if (!role) return '—'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const planLabel = computed(() => {
  const tier = profile.value?.organization?.planTier
  if (tier === 'PRO') return 'Pro'
  if (tier === 'ENTERPRISE') return 'Enterprise'
  return 'Free'
})

const planClass = computed(() => {
  const tier = profile.value?.organization?.planTier
  if (tier === 'PRO') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
  if (tier === 'ENTERPRISE') return 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400'
  return 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'
})

const seatLabel = computed(() => {
  const type = profile.value?.seatType
  if (type === 'INTERNAL') return 'Internal'
  if (type === 'EXTERNAL') return 'External'
  return '—'
})

const initials = computed(() => {
  const name = editedName.value || profile.value?.name || profile.value?.email || '?'
  return name.charAt(0).toUpperCase()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50" @click.self="emit('close')">
      <div class="bg-white dark:bg-dm-panel rounded-2xl shadow-xl border border-transparent dark:border-white/[0.06] w-full max-w-md mx-4 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 class="text-base font-semibold text-slate-900 dark:text-zinc-100">Account settings</h2>
          <button @click="emit('close')" class="p-1 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="p-6 flex items-center justify-center">
          <Icon name="heroicons:arrow-path" class="w-5 h-5 text-slate-400 dark:text-zinc-500 animate-spin" />
        </div>

        <!-- Content -->
        <div v-else class="p-6 space-y-6">
          <!-- Profile Section -->
          <div>
            <div class="flex items-center gap-4 mb-5">
              <div class="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center flex-shrink-0">
                <span class="text-xl font-semibold text-white">{{ initials }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900 dark:text-zinc-200 truncate">{{ profile?.name || 'Unnamed' }}</div>
                <div class="text-xs text-slate-500 dark:text-zinc-500 truncate">{{ profile?.email }}</div>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-500 mb-1">Name</label>
                <input
                  v-model="editedName"
                  type="text"
                  maxlength="100"
                  placeholder="Your name"
                  class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 focus:border-slate-300 dark:focus:border-white/[0.1] transition-all"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-500 mb-1">Position</label>
                <input
                  v-model="editedPosition"
                  type="text"
                  maxlength="100"
                  placeholder="e.g. Engineering Manager"
                  class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 focus:border-slate-300 dark:focus:border-white/[0.1] transition-all"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-500 mb-1">Email</label>
                <div class="px-3 py-2 text-sm text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] rounded-lg">
                  {{ profile?.email }}
                </div>
              </div>
            </div>

            <!-- Save -->
            <div class="mt-4 flex items-center gap-3">
              <button
                @click="handleSave"
                :disabled="!canSave"
                class="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {{ saving ? 'Saving...' : 'Save changes' }}
              </button>
              <span v-if="saveSuccess" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
              <span v-if="saveError" class="text-xs text-rose-600 dark:text-rose-400">{{ saveError }}</span>
            </div>
          </div>

          <!-- Divider -->
          <div class="border-t border-slate-100 dark:border-white/[0.06]" />

          <!-- Access & Context -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Access</h3>
            <div class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600 dark:text-zinc-400">Organization</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900 dark:text-zinc-200">{{ profile?.organization?.name || '—' }}</span>
                  <span v-if="profile?.organization?.role" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400">
                    {{ roleLabel(profile.organization.role) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600 dark:text-zinc-400">Workspace</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900 dark:text-zinc-200">{{ currentWorkspace?.name || '—' }}</span>
                  <span v-if="currentRole" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400">
                    {{ roleLabel(currentRole) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600 dark:text-zinc-400">Plan</span>
                <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full', planClass]">
                  {{ planLabel }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600 dark:text-zinc-400">Seat type</span>
                <span class="text-sm font-medium text-slate-900 dark:text-zinc-200">{{ seatLabel }}</span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600 dark:text-zinc-400">Member since</span>
                <span class="text-sm text-slate-900 dark:text-zinc-200">{{ profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="border-t border-slate-100 dark:border-white/[0.06]" />

          <!-- Log out -->
          <button
            @click="handleLogout"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/5 rounded-lg transition-colors"
          >
            <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
