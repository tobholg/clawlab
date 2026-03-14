<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'guest',
})

const route = useRoute()
const { requestMagicLink } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)
const pageReady = ref(false)

// Auth mode detection
const authMode = ref<{ magicLink: boolean; password: boolean; singleUser: boolean } | null>(null)

const { data: authModeData } = await useFetch('/api/auth/mode')
if (authModeData.value) {
  authMode.value = authModeData.value
}

const hasMagicLink = computed(() => authMode.value?.magicLink ?? false)
const isSingleUser = computed(() => authMode.value?.singleUser ?? false)

// Active auth tab
const activeTab = ref<'password' | 'magic-link'>('password')

// Get redirect URL from query params (used by invite flow)
const redirect = computed(() => route.query.redirect as string | undefined)

// Extract invite token if redirect is to an invite page
const inviteToken = computed(() => {
  if (redirect.value?.startsWith('/invite/')) {
    return redirect.value.replace('/invite/', '')
  }
  return undefined
})

const handlePasswordLogin = async () => {
  if (!password.value) return
  if (!isSingleUser.value && !email.value) return

  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        password: password.value,
        ...(!isSingleUser.value && { email: email.value.trim().toLowerCase() }),
      },
    })
    await navigateTo(redirect.value || '/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Invalid credentials'
  } finally {
    loading.value = false
  }
}

const handleMagicLink = async () => {
  if (!email.value) return

  loading.value = true
  error.value = ''

  try {
    const response = await requestMagicLink(email.value, {
      inviteToken: inviteToken.value
    })
    if (response.ok) {
      success.value = true
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

const handleSubmit = () => {
  if (activeTab.value === 'magic-link') {
    handleMagicLink()
  } else {
    handlePasswordLogin()
  }
}

onMounted(() => {
  requestAnimationFrame(() => {
    pageReady.value = true
  })
})
</script>

<template>
  <div class="clawlab-auth min-h-screen text-slate-900 dark:text-zinc-100" :class="{ 'is-ready': pageReady }">
    <!-- Background -->
    <div class="fixed inset-0 -z-10 auth-bg" aria-hidden="true" />

    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#050506]/80 border-b border-slate-100 dark:border-white/[0.06] intro" style="--d: 0ms">
      <div class="w-full px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 dark:bg-white/[0.08] rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <span class="text-lg font-semibold tracking-tight">ClawLab</span>
        </NuxtLink>

        <div class="flex items-center gap-4">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 dark:border-white/[0.08] text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all bg-white/70 dark:bg-white/[0.04]"
          >
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            <span>Back to home</span>
          </NuxtLink>
          <div class="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-500">
            <span>New here?</span>
            <NuxtLink
              to="/onboarding"
              class="px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Get started
            </NuxtLink>
          </div>
          <NuxtLink
            to="/onboarding"
            class="sm:hidden px-3 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Get started
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="relative min-h-screen flex flex-col px-6 pt-24 pb-10">
        <div class="max-w-6xl mx-auto w-full my-auto grid lg:grid-cols-[1.05fr,0.95fr] gap-10 xl:gap-14 items-center">
        <!-- Left Copy -->
        <section>
          <h1 class="text-3xl sm:text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">
            <span class="word-animate" style="--d: 180ms">Welcome</span>
            <span class="word-animate" style="--d: 240ms">back</span>
            <span class="word-animate word-animate--accent" style="--d: 300ms">to your instance.</span>
          </h1>

          <p class="mt-6 text-lg text-slate-600 dark:text-zinc-400 max-w-xl intro" style="--d: 420ms">
            Sign in to your self-hosted workspace. Your data, your server.
          </p>

          <div class="mt-10 grid sm:grid-cols-2 gap-6 intro" style="--d: 520ms">
            <div class="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-5 shadow-lg shadow-slate-200/40 dark:shadow-none">
              <div class="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">Open Source</div>
              <div class="mt-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">Humans and agents</div>
              <p class="mt-2 text-sm text-slate-600 dark:text-zinc-400">Recursive task model with AI agents as actual teammates.</p>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-5 shadow-lg shadow-slate-200/40 dark:shadow-none">
              <div class="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">Self-Hosted</div>
              <div class="mt-2 text-sm font-semibold text-slate-900 dark:text-zinc-100">Run anywhere</div>
              <p class="mt-2 text-sm text-slate-600 dark:text-zinc-400">No telemetry, no external calls. Full control over your data.</p>
            </div>
          </div>
        </section>

        <!-- Form Card -->
        <section class="relative lg:self-center">
          <div class="auth-card intro" style="--d: 220ms">
            <div class="text-center mb-8">
              <h2 class="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight mb-2">Sign in to ClawLab</h2>
              <p v-if="isSingleUser" class="text-slate-500 dark:text-zinc-400">Enter your password to continue.</p>
              <p v-else-if="hasMagicLink" class="text-slate-500 dark:text-zinc-400">Sign in with a magic link or password.</p>
              <p v-else class="text-slate-500 dark:text-zinc-400">Enter your credentials to continue.</p>
            </div>

            <!-- Auth method tabs (only if magic link is available and multi-user) -->
            <div v-if="hasMagicLink && !isSingleUser" class="flex bg-slate-100 dark:bg-white/[0.06] rounded-xl p-1 mb-6">
              <button
                @click="activeTab = 'password'; error = ''; success = false"
                :class="[
                  'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                  activeTab === 'password'
                    ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-zinc-100 shadow-sm dark:shadow-none'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                ]"
              >
                Password
              </button>
              <button
                @click="activeTab = 'magic-link'; error = ''; success = false"
                :class="[
                  'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                  activeTab === 'magic-link'
                    ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-zinc-100 shadow-sm dark:shadow-none'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                ]"
              >
                Magic Link
              </button>
            </div>

            <form class="space-y-5" @submit.prevent="handleSubmit">
              <!-- Email (shown for multi-user, or magic link tab) -->
              <div v-if="!isSingleUser">
                <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Email address</label>
                <input
                  v-model="email"
                  type="email"
                  name="email"
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.1] focus:border-slate-400 dark:focus:border-white/[0.2] focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/[0.05] outline-none bg-white dark:bg-white/[0.03] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-all"
                  placeholder="you@company.com"
                  required
                  :disabled="success"
                />
              </div>

              <!-- Password (shown for password tab) -->
              <div v-if="activeTab === 'password'">
                <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Password</label>
                <input
                  v-model="password"
                  type="password"
                  name="password"
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.1] focus:border-slate-400 dark:focus:border-white/[0.2] focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/[0.05] outline-none bg-white dark:bg-white/[0.03] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-all"
                  placeholder="Enter your password"
                  required
                  :disabled="success"
                />
              </div>

              <button
                type="submit"
                class="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 px-4 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-zinc-200 transition-all hover:scale-[1.01] shadow-lg shadow-slate-900/10 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                :disabled="loading || success"
              >
                <Icon v-if="loading" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                <template v-else-if="success">
                  <Icon name="heroicons:check-circle" class="w-5 h-5" />
                  <span>Check your email</span>
                </template>
                <template v-else-if="activeTab === 'magic-link'">
                  <span>Send Magic Link</span>
                  <Icon name="heroicons:arrow-right" class="w-5 h-5" />
                </template>
                <template v-else>
                  <span>Sign In</span>
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
              <div v-if="error" class="mt-5 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl">
                <div class="flex items-start gap-3">
                  <Icon name="heroicons:exclamation-circle" class="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p class="text-sm text-rose-700 dark:text-rose-400">{{ error }}</p>
                </div>
              </div>
              <div v-else-if="success" class="mt-5 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                <div class="flex items-start gap-3">
                  <Icon name="heroicons:sparkles" class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="text-sm font-medium text-emerald-800 dark:text-emerald-300">Magic link sent!</p>
                    <p class="text-sm text-emerald-600 dark:text-emerald-400 mt-1">Check your inbox for a link and a 4-character verification code. The link expires in 1 hour.</p>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- Divider -->
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-slate-100 dark:border-white/[0.06]" />
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="px-3 bg-white dark:bg-transparent text-slate-400 dark:text-zinc-500">Open source. Self-hosted.</span>
              </div>
            </div>

            <!-- Info -->
            <p class="text-center text-sm text-slate-500 dark:text-zinc-500">
              Your data stays on your server. You are in control.
            </p>
          </div>

        </section>
      </div>

        <!-- Footer -->
        <p class="text-center text-sm text-slate-400 dark:text-zinc-500 mt-12 intro" style="--d: 620ms">
          By signing in, you agree to our
          <a href="#" class="text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors">Terms</a>
          and
          <a href="#" class="text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors">Privacy Policy</a>
        </p>
    </main>
  </div>
</template>

<style scoped>
/* ── Background ──────────────────────────────────── */

.auth-bg {
  background-image:
    radial-gradient(60% 60% at 85% 12%, rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0)),
    linear-gradient(120deg, rgba(16, 185, 129, 0.18) 0%, rgba(255, 255, 255, 0.96) 45%),
    linear-gradient(300deg, rgba(56, 189, 248, 0.16) 0%, rgba(255, 255, 255, 0.96) 55%),
    linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
}

@media (prefers-color-scheme: dark) {
  .auth-bg {
    background-image: none;
    background: linear-gradient(180deg, #050506 0%, #0f0f18 100%);
  }
}

/* ── Card ─────────────────────────────────────────── */

.auth-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.12), 0 10px 30px rgba(15, 23, 42, 0.06);
  padding: 32px;
  backdrop-filter: blur(10px);
}

@media (prefers-color-scheme: dark) {
  .auth-card {
    border-color: rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.2);
  }
}

.intro {
  opacity: 0;
  transform: translateY(16px);
  filter: blur(8px);
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform, filter;
}

.is-ready .intro {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

.word-animate {
  display: inline-block;
  margin-right: 0.3em;
  opacity: 0;
  filter: blur(10px);
  transform: translateY(8px);
  transition:
    opacity 0.6s ease-out,
    transform 0.6s ease-out,
    filter 0.6s ease-out;
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform, filter;
}

.word-animate--accent {
  background-image: linear-gradient(120deg, #64748b, #94a3b8, #4ade80);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

@media (prefers-color-scheme: dark) {
  .word-animate--accent {
    background-image: linear-gradient(120deg, #94a3b8, #e2e8f0, #4ade80);
  }
}

.is-ready .word-animate {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

@media (max-width: 640px) {
  .auth-card {
    padding: 26px;
  }
}

@media (min-width: 1280px) {
  .auth-card {
    padding: 36px;
  }
}
</style>
