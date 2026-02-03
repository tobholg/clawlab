<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const router = useRouter()
const token = computed(() => route.params.token as string)

// Auth state
const { user, isAuthenticated, fetchUser } = useAuth()

// Invite validation state
const loading = ref(true)
const validating = ref(false)
const accepting = ref(false)
const error = ref('')
const inviteData = ref<{
  valid: boolean
  space: { id: string; name: string; slug: string; description?: string }
  project: { id: string; title: string; description?: string }
} | null>(null)

// Signup form state
const showSignupForm = ref(false)
const signupForm = reactive({
  email: '',
  displayName: '',
  position: ''
})
const signupError = ref('')
const signupSuccess = ref(false)

// Validate the invite token
const validateInvite = async () => {
  validating.value = true
  error.value = ''
  
  try {
    const data = await $fetch(`/api/invite/${token.value}`)
    inviteData.value = data as any
  } catch (e: any) {
    error.value = e.data?.message || 'Invalid or expired invite link'
  } finally {
    loading.value = false
    validating.value = false
  }
}

// Accept invite for logged-in user
const acceptInvite = async () => {
  if (!isAuthenticated.value) {
    showSignupForm.value = true
    return
  }
  
  accepting.value = true
  error.value = ''
  
  try {
    const result = await $fetch(`/api/invite/${token.value}/accept`, {
      method: 'POST',
      body: {
        displayName: signupForm.displayName || undefined,
        position: signupForm.position || undefined
      }
    })
    
    // Redirect to the stakeholder portal
    router.push(`/s/${(result as any).space.slug}`)
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to accept invite'
  } finally {
    accepting.value = false
  }
}

// Signup and accept invite
const handleSignup = async () => {
  if (!signupForm.email) {
    signupError.value = 'Email is required'
    return
  }
  
  signupError.value = ''
  accepting.value = true
  
  try {
    // Request magic link with invite context
    await $fetch('/api/auth/request-magic-link', {
      method: 'POST',
      body: { 
        email: signupForm.email,
        inviteToken: token.value,
        displayName: signupForm.displayName || undefined,
        position: signupForm.position || undefined
      }
    })
    
    signupSuccess.value = true
  } catch (e: any) {
    signupError.value = e.data?.message || 'Failed to send magic link'
  } finally {
    accepting.value = false
  }
}

// Check if we should auto-accept (came from magic link flow)
const shouldAutoAccept = computed(() => {
  return isAuthenticated.value && inviteData.value?.valid && !error.value
})

// Auto-accept invite for authenticated users coming from magic link
const tryAutoAccept = async () => {
  if (!shouldAutoAccept.value || accepting.value) return
  
  accepting.value = true
  
  try {
    const result = await $fetch(`/api/invite/${token.value}/accept`, {
      method: 'POST',
      body: {}
    })
    
    // Redirect to the stakeholder portal
    router.push(`/s/${(result as any).space.slug}`)
  } catch (e: any) {
    // If already a member, redirect to portal anyway
    if (e.data?.message?.includes('already')) {
      if (inviteData.value?.space?.slug) {
        router.push(`/s/${inviteData.value.space.slug}`)
        return
      }
    }
    // Otherwise show the manual form
    error.value = ''
    accepting.value = false
  }
}

// Check auth and validate invite on mount
onMounted(async () => {
  await fetchUser()
  await validateInvite()
  
  // Auto-accept if authenticated (e.g., coming back from magic link)
  if (isAuthenticated.value && inviteData.value?.valid) {
    await tryAutoAccept()
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-violet-50 via-white to-slate-50">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <span class="text-white text-sm font-semibold">R</span>
          </div>
          <span class="text-lg font-semibold tracking-tight">Relai</span>
        </NuxtLink>
        
        <div v-if="isAuthenticated" class="flex items-center gap-4">
          <span class="text-sm text-slate-500">Signed in as {{ user?.email }}</span>
        </div>
        <div v-else class="flex items-center gap-4">
          <NuxtLink 
            to="/login" 
            class="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign in
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="min-h-screen flex items-center justify-center px-6 pt-16">
      <div class="w-full max-w-md">
        <!-- Loading State -->
        <div v-if="loading" class="text-center">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-violet-500 animate-spin mx-auto mb-4" />
          <p class="text-slate-500">Validating invite...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error && !inviteData" class="text-center">
          <div class="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:exclamation-circle" class="w-8 h-8 text-rose-500" />
          </div>
          <h1 class="text-2xl font-semibold text-slate-900 mb-2">Invalid Invite</h1>
          <p class="text-slate-500 mb-6">{{ error }}</p>
          <NuxtLink 
            to="/login" 
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to Login
          </NuxtLink>
        </div>

        <!-- Valid Invite -->
        <div v-else-if="inviteData" class="space-y-6">
          <!-- Header -->
          <div class="text-center">
            <div class="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:envelope-open" class="w-8 h-8 text-violet-500" />
            </div>
            <h1 class="text-2xl font-semibold text-slate-900 mb-2">
              You're invited!
            </h1>
            <p class="text-slate-500">
              Join the <span class="font-medium text-slate-700">{{ inviteData.space.name }}</span> portal
              <br />
              for <span class="font-medium text-slate-700">{{ inviteData.project.title }}</span>
            </p>
          </div>

          <!-- Card -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6">
            <!-- Space Info -->
            <div class="bg-violet-50 rounded-xl p-4 mb-6">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon name="heroicons:globe-alt" class="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 class="font-medium text-slate-900">{{ inviteData.space.name }}</h3>
                  <p class="text-sm text-slate-500">{{ inviteData.project.title }}</p>
                  <p v-if="inviteData.space.description" class="text-sm text-slate-600 mt-1">
                    {{ inviteData.space.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Already authenticated: Just accept -->
            <div v-if="isAuthenticated && !showSignupForm">
              <!-- Optional profile fields -->
              <div class="space-y-4 mb-6">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">
                    Display Name <span class="text-slate-400">(optional)</span>
                  </label>
                  <input
                    v-model="signupForm.displayName"
                    type="text"
                    class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 outline-none bg-white text-slate-900 placeholder-slate-400 transition-all text-sm"
                    placeholder="How you'd like to appear"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">
                    Position <span class="text-slate-400">(optional)</span>
                  </label>
                  <input
                    v-model="signupForm.position"
                    type="text"
                    class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 outline-none bg-white text-slate-900 placeholder-slate-400 transition-all text-sm"
                    placeholder="e.g., Product Manager, CTO"
                  />
                </div>
              </div>

              <button
                @click="acceptInvite"
                :disabled="accepting"
                class="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon v-if="accepting" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                <template v-else>
                  <span>Join Portal</span>
                  <Icon name="heroicons:arrow-right" class="w-5 h-5" />
                </template>
              </button>

              <p v-if="error" class="mt-4 text-sm text-rose-600 text-center">{{ error }}</p>
            </div>

            <!-- Not authenticated: Show signup form -->
            <div v-else>
              <!-- Success state -->
              <div v-if="signupSuccess" class="text-center py-4">
                <Icon name="heroicons:check-circle" class="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 class="font-medium text-slate-900 mb-1">Check your email!</h3>
                <p class="text-sm text-slate-500">
                  We sent a magic link to <strong>{{ signupForm.email }}</strong>.
                  <br />
                  Click it to join the portal.
                </p>
              </div>

              <!-- Signup form -->
              <form v-else class="space-y-4" @submit.prevent="handleSignup">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">
                    Email address <span class="text-rose-500">*</span>
                  </label>
                  <input
                    v-model="signupForm.email"
                    type="email"
                    required
                    class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 outline-none bg-white text-slate-900 placeholder-slate-400 transition-all text-sm"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">
                    Display Name <span class="text-slate-400">(optional)</span>
                  </label>
                  <input
                    v-model="signupForm.displayName"
                    type="text"
                    class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 outline-none bg-white text-slate-900 placeholder-slate-400 transition-all text-sm"
                    placeholder="How you'd like to appear"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">
                    Position <span class="text-slate-400">(optional)</span>
                  </label>
                  <input
                    v-model="signupForm.position"
                    type="text"
                    class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 outline-none bg-white text-slate-900 placeholder-slate-400 transition-all text-sm"
                    placeholder="e.g., Product Manager, CTO"
                  />
                </div>

                <button
                  type="submit"
                  :disabled="accepting"
                  class="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon v-if="accepting" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                  <template v-else>
                    <span>Continue with Email</span>
                    <Icon name="heroicons:arrow-right" class="w-5 h-5" />
                  </template>
                </button>

                <p v-if="signupError" class="text-sm text-rose-600 text-center">{{ signupError }}</p>

                <div class="relative">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-slate-100" />
                  </div>
                  <div class="relative flex justify-center text-xs">
                    <span class="px-3 bg-white text-slate-400">Already have an account?</span>
                  </div>
                </div>

                <NuxtLink
                  :to="`/login?redirect=/invite/${token}`"
                  class="block w-full text-center py-2.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  Sign in instead
                </NuxtLink>
              </form>
            </div>
          </div>

          <!-- Footer -->
          <p class="text-center text-sm text-slate-400">
            Powered by 
            <a href="/" class="text-slate-600 hover:text-slate-900 transition-colors">Relai</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
