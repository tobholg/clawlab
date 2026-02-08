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
  if (tier === 'PRO') return 'bg-blue-100 text-blue-700'
  if (tier === 'ENTERPRISE') return 'bg-violet-100 text-violet-700'
  return 'bg-slate-100 text-slate-600'
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
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="emit('close')">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 class="text-base font-semibold text-slate-900">Account settings</h2>
          <button @click="emit('close')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="p-6 flex items-center justify-center">
          <Icon name="heroicons:arrow-path" class="w-5 h-5 text-slate-400 animate-spin" />
        </div>

        <!-- Content -->
        <div v-else class="p-6 space-y-6">
          <!-- Profile Section -->
          <div>
            <div class="flex items-center gap-4 mb-5">
              <div class="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
                <span class="text-xl font-semibold text-white">{{ initials }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900 truncate">{{ profile?.name || 'Unnamed' }}</div>
                <div class="text-xs text-slate-500 truncate">{{ profile?.email }}</div>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Name</label>
                <input
                  v-model="editedName"
                  type="text"
                  maxlength="100"
                  placeholder="Your name"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Position</label>
                <input
                  v-model="editedPosition"
                  type="text"
                  maxlength="100"
                  placeholder="e.g. Engineering Manager"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <div class="px-3 py-2 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-lg">
                  {{ profile?.email }}
                </div>
              </div>
            </div>

            <!-- Save -->
            <div class="mt-4 flex items-center gap-3">
              <button
                @click="handleSave"
                :disabled="!canSave"
                class="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {{ saving ? 'Saving...' : 'Save changes' }}
              </button>
              <span v-if="saveSuccess" class="text-xs text-emerald-600 font-medium">Saved</span>
              <span v-if="saveError" class="text-xs text-rose-600">{{ saveError }}</span>
            </div>
          </div>

          <!-- Divider -->
          <div class="border-t border-slate-100" />

          <!-- Access & Context -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Access</h3>
            <div class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600">Organization</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900">{{ profile?.organization?.name || '—' }}</span>
                  <span v-if="profile?.organization?.role" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {{ roleLabel(profile.organization.role) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600">Workspace</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900">{{ currentWorkspace?.name || '—' }}</span>
                  <span v-if="currentRole" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {{ roleLabel(currentRole) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600">Plan</span>
                <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full', planClass]">
                  {{ planLabel }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600">Seat type</span>
                <span class="text-sm font-medium text-slate-900">{{ seatLabel }}</span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-600">Member since</span>
                <span class="text-sm text-slate-900">{{ profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="border-t border-slate-100" />

          <!-- Log out -->
          <button
            @click="handleLogout"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Icon name="heroicons:arrow-right-on-rectangle" class="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
