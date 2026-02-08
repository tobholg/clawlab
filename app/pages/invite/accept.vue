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

// Code verification
const code = ref('')
const codeError = ref('')
const inputRefs = ref<HTMLInputElement[]>([])

const codeDigits = computed(() => code.value.split(''))

const setInputRef = (el: any, index: number) => {
  if (el) inputRefs.value[index] = el
}

const handleInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement
  let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (val.length > 1) {
    const fullPaste = val.slice(0, 4)
    code.value = fullPaste
    const nextIndex = Math.min(fullPaste.length, 3)
    inputRefs.value[nextIndex]?.focus()
    return
  }

  const chars = code.value.split('')
  chars[index] = val
  code.value = chars.join('').slice(0, 4)

  if (val && index < 3) {
    inputRefs.value[index + 1]?.focus()
  }
}

const handleKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !code.value[index] && index > 0) {
    const chars = code.value.split('')
    chars[index - 1] = ''
    code.value = chars.join('')
    inputRefs.value[index - 1]?.focus()
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pasted = (event.clipboardData?.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  if (pasted) {
    code.value = pasted
    const nextIndex = Math.min(pasted.length, 3)
    inputRefs.value[nextIndex]?.focus()
  }
}

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
    // Focus code input
    nextTick(() => inputRefs.value[0]?.focus())
  } catch (e: any) {
    verifyState.value = 'invalid'
    errorMessage.value = e?.data?.message || 'Failed to verify invite'
  }
}

const acceptInvite = async () => {
  if (code.value.length !== 4) return

  verifyState.value = 'accepting'
  codeError.value = ''
  try {
    const result = await $fetch(`/api/seats/invites/${token.value}/accept`, {
      method: 'POST',
      body: { code: code.value },
    })
    acceptedWorkspace.value = result.workspace
    verifyState.value = 'success'
  } catch (e: any) {
    const msg = e?.data?.message || 'Failed to accept invite'
    if (msg.toLowerCase().includes('verification code')) {
      // Code error — stay on form
      codeError.value = msg
      verifyState.value = 'ready'
      code.value = ''
      nextTick(() => inputRefs.value[0]?.focus())
    } else {
      verifyState.value = 'error'
      errorMessage.value = msg
    }
  }
}

// Auto-submit when 4 chars entered
watch(code, (val) => {
  if (val.length === 4 && verifyState.value === 'ready' && isAuthenticated.value) {
    acceptInvite()
  }
})

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

      <!-- Ready to accept (with code input) -->
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

        <!-- Code input -->
        <p class="text-sm text-slate-600 mb-4">Enter the 4-character code from your invite email:</p>
        <form @submit.prevent="acceptInvite">
          <div class="flex justify-center gap-3 mb-4">
            <input
              v-for="i in 4"
              :key="i"
              :ref="(el) => setInputRef(el, i - 1)"
              type="text"
              :value="codeDigits[i - 1] || ''"
              maxlength="4"
              class="w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all outline-none uppercase font-mono"
              :class="codeError
                ? 'border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100'
                : 'border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100'"
              @input="handleInput(i - 1, $event)"
              @keydown="handleKeydown(i - 1, $event)"
              @paste="handlePaste"
            />
          </div>

          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
          >
            <div v-if="codeError" class="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl">
              <div class="flex items-center gap-2 justify-center">
                <Icon name="heroicons:exclamation-circle" class="w-4 h-4 text-rose-500 flex-shrink-0" />
                <p class="text-sm text-rose-700">{{ codeError }}</p>
              </div>
            </div>
          </Transition>

          <button
            type="submit"
            :disabled="code.length !== 4"
            class="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Verify and join
          </button>
        </form>
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
