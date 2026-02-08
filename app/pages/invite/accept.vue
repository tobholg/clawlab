<script setup lang="ts">
definePageMeta({
  layout: false,
})

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated } = useAuth()

const token = computed(() => route.query.token as string)

const verifyState = ref<'loading' | 'invalid' | 'expired' | 'email_mismatch' | 'ready' | 'accepting' | 'success' | 'error'>('loading')
const inviteData = ref<any>(null)
const errorMessage = ref('')
const acceptedWorkspace = ref<any>(null)

const fetchInvite = async () => {
  if (!token.value) {
    verifyState.value = 'invalid'
    return
  }

  verifyState.value = 'loading'
  try {
    const data = await $fetch('/api/seats/invites/verify', {
      query: { token: token.value },
    })

    if (!data.valid) {
      verifyState.value = data.status === 'EXPIRED' ? 'expired' : 'invalid'
      errorMessage.value = data.message || 'This invite is no longer valid'
      return
    }

    inviteData.value = data

    // Check email match if logged in
    if (isAuthenticated.value && user.value) {
      if (user.value.email.toLowerCase() !== data.email.toLowerCase()) {
        verifyState.value = 'email_mismatch'
        return
      }
    }

    verifyState.value = 'ready'
  } catch (e: any) {
    verifyState.value = 'invalid'
    errorMessage.value = e?.data?.message || 'Failed to verify invite'
  }
}

const acceptInvite = async () => {
  verifyState.value = 'accepting'
  try {
    const result = await $fetch(`/api/seats/invites/${token.value}/accept`, {
      method: 'POST',
    })
    acceptedWorkspace.value = result.workspace
    verifyState.value = 'success'
  } catch (e: any) {
    verifyState.value = 'error'
    errorMessage.value = e?.data?.message || 'Failed to accept invite'
  }
}

const goToWorkspace = () => {
  router.push('/workspace')
}

const goToLogin = () => {
  router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
}

onMounted(fetchInvite)
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-8">

      <!-- Loading -->
      <div v-if="verifyState === 'loading'" class="text-center py-8">
        <Icon name="heroicons:arrow-path" class="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
        <p class="text-sm text-slate-500">Verifying invite...</p>
      </div>

      <!-- Invalid / Expired -->
      <div v-else-if="verifyState === 'invalid' || verifyState === 'expired'" class="text-center py-4">
        <div class="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:x-circle" class="w-6 h-6 text-red-600" />
        </div>
        <h1 class="text-lg font-medium text-slate-900 mb-2">
          {{ verifyState === 'expired' ? 'Invite expired' : 'Invalid invite' }}
        </h1>
        <p class="text-sm text-slate-500 mb-6">{{ errorMessage }}</p>
        <button
          @click="router.push('/')"
          class="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go home
        </button>
      </div>

      <!-- Not logged in -->
      <div v-else-if="verifyState === 'ready' && !isAuthenticated" class="text-center py-4">
        <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:envelope" class="w-6 h-6 text-blue-600" />
        </div>
        <h1 class="text-lg font-medium text-slate-900 mb-2">You've been invited</h1>
        <p class="text-sm text-slate-500 mb-1">
          Join <strong>{{ inviteData?.workspace?.name }}</strong> at <strong>{{ inviteData?.organization?.name }}</strong>
        </p>
        <p class="text-xs text-slate-400 mb-6">
          Invited by {{ inviteData?.invitedBy?.name || inviteData?.invitedBy?.email }}
        </p>
        <p class="text-sm text-slate-600 mb-4">
          Sign in with <strong>{{ inviteData?.email }}</strong> to accept this invite.
        </p>
        <button
          @click="goToLogin"
          class="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Sign in to accept
        </button>
      </div>

      <!-- Email mismatch -->
      <div v-else-if="verifyState === 'email_mismatch'" class="text-center py-4">
        <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-amber-600" />
        </div>
        <h1 class="text-lg font-medium text-slate-900 mb-2">Email mismatch</h1>
        <p class="text-sm text-slate-500 mb-2">
          This invite was sent to <strong>{{ inviteData?.email }}</strong>
        </p>
        <p class="text-sm text-slate-500 mb-6">
          You're logged in as <strong>{{ user?.email }}</strong>
        </p>
        <p class="text-xs text-slate-400 mb-4">Sign in with the correct email to accept this invite.</p>
        <button
          @click="goToLogin"
          class="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Sign in with a different account
        </button>
      </div>

      <!-- Ready to accept -->
      <div v-else-if="verifyState === 'ready' && isAuthenticated" class="text-center py-4">
        <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:user-plus" class="w-6 h-6 text-emerald-600" />
        </div>
        <h1 class="text-lg font-medium text-slate-900 mb-2">Accept invite</h1>
        <p class="text-sm text-slate-500 mb-1">
          Join <strong>{{ inviteData?.workspace?.name }}</strong> at <strong>{{ inviteData?.organization?.name }}</strong>
        </p>
        <p class="text-xs text-slate-400 mb-1">
          Role: <span class="font-medium">{{ inviteData?.role }}</span>
        </p>
        <p class="text-xs text-slate-400 mb-6">
          Invited by {{ inviteData?.invitedBy?.name || inviteData?.invitedBy?.email }}
        </p>
        <button
          @click="acceptInvite"
          class="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Accept and join
        </button>
      </div>

      <!-- Accepting -->
      <div v-else-if="verifyState === 'accepting'" class="text-center py-8">
        <Icon name="heroicons:arrow-path" class="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
        <p class="text-sm text-slate-500">Joining workspace...</p>
      </div>

      <!-- Success -->
      <div v-else-if="verifyState === 'success'" class="text-center py-4">
        <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:check-circle" class="w-6 h-6 text-emerald-600" />
        </div>
        <h1 class="text-lg font-medium text-slate-900 mb-2">You're in!</h1>
        <p class="text-sm text-slate-500 mb-6">
          You've joined <strong>{{ acceptedWorkspace?.name }}</strong>
        </p>
        <button
          @click="goToWorkspace"
          class="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go to workspace
        </button>
      </div>

      <!-- Error -->
      <div v-else-if="verifyState === 'error'" class="text-center py-4">
        <div class="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:x-circle" class="w-6 h-6 text-red-600" />
        </div>
        <h1 class="text-lg font-medium text-slate-900 mb-2">Something went wrong</h1>
        <p class="text-sm text-slate-500 mb-6">{{ errorMessage }}</p>
        <button
          @click="fetchInvite"
          class="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  </div>
</template>
