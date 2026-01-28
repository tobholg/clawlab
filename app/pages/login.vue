<script setup lang="ts">
definePageMeta({
  layout: false
})

const { requestMagicLink } = useAuth()

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const handleSubmit = async () => {
  if (!email.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await requestMagicLink(email.value)
    if (response.ok) {
      success.value = true
      // In development, log the link for easy testing
      if (response.link) {
        console.log('Magic link:', response.link)
      }
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to send magic link'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <span class="text-white text-sm font-semibold">R</span>
          </div>
          <span class="text-lg font-semibold tracking-tight">Relai</span>
        </NuxtLink>
        
        <div class="flex items-center gap-4">
          <span class="text-sm text-slate-500">Don't have an account?</span>
          <NuxtLink 
            to="/onboarding" 
            class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="min-h-screen flex items-center justify-center px-6 pt-16">
      <div class="w-full max-w-md">
        <!-- Header -->
        <div class="text-center mb-8">
          <h1 class="text-3xl font-semibold text-slate-900 tracking-tight mb-3">
            Welcome back
          </h1>
          <p class="text-slate-500">
            Sign in to your workspace
          </p>
        </div>

        <!-- Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8">
          <form class="space-y-5" @submit.prevent="handleSubmit">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <input
                v-model="email"
                type="email"
                name="email"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 outline-none bg-white text-slate-900 placeholder-slate-400 transition-all"
                placeholder="you@company.com"
                required
                :disabled="success"
              />
            </div>

            <button
              type="submit"
              class="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-slate-800 transition-all hover:scale-[1.01] shadow-lg shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              :disabled="loading || success"
            >
              <Icon v-if="loading" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
              <template v-else-if="success">
                <Icon name="heroicons:check-circle" class="w-5 h-5" />
                <span>Check your email</span>
              </template>
              <template v-else>
                <span>Continue with Email</span>
                <Icon name="heroicons:arrow-right" class="w-5 h-5" />
              </template>
            </button>
          </form>

          <!-- Status messages -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
          >
            <div v-if="error" class="mt-5 p-4 bg-rose-50 border border-rose-100 rounded-xl">
              <div class="flex items-start gap-3">
                <Icon name="heroicons:exclamation-circle" class="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <p class="text-sm text-rose-700">{{ error }}</p>
              </div>
            </div>
            <div v-else-if="success" class="mt-5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div class="flex items-start gap-3">
                <Icon name="heroicons:sparkles" class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-emerald-800">Magic link sent!</p>
                  <p class="text-sm text-emerald-600 mt-1">Check your inbox for a link to sign in. It'll expire in 15 minutes.</p>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Divider -->
          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-100" />
            </div>
            <div class="relative flex justify-center text-xs">
              <span class="px-3 bg-white text-slate-400">Passwordless sign in</span>
            </div>
          </div>

          <!-- Info -->
          <p class="text-center text-sm text-slate-500">
            We'll send you a magic link to sign in instantly.
            <br />
            No password needed.
          </p>
        </div>

        <!-- Footer -->
        <p class="text-center text-sm text-slate-400 mt-8">
          By signing in, you agree to our 
          <a href="#" class="text-slate-600 hover:text-slate-900 transition-colors">Terms</a>
          and 
          <a href="#" class="text-slate-600 hover:text-slate-900 transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  </div>
</template>
