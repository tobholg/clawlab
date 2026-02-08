<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const { confirmMagicLink } = useAuth()

const token = computed(() => route.query.token as string | undefined)
const redirect = computed(() => route.query.redirect as string | undefined)

const code = ref('')
const loading = ref(false)
const error = ref('')
const verified = ref(false)

// Auto-focus the first input on mount
const inputRefs = ref<HTMLInputElement[]>([])

const codeDigits = computed({
  get: () => code.value.split(''),
  set: () => {}
})

const setInputRef = (el: any, index: number) => {
  if (el) inputRefs.value[index] = el
}

const handleInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement
  let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (val.length > 1) {
    // Handle paste into a single field
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

const handleSubmit = async () => {
  if (!token.value || code.value.length !== 4) return

  loading.value = true
  error.value = ''

  try {
    await confirmMagicLink(token.value, code.value)
    verified.value = true

    // Redirect after short delay
    setTimeout(() => {
      const redirectTo = redirect.value || '/workspace'
      if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
        navigateTo(redirectTo)
      } else {
        navigateTo('/workspace')
      }
    }, 800)
  } catch (e: any) {
    error.value = e.data?.message || e.data?.statusMessage || 'Invalid or expired code'
    // Clear code on error
    code.value = ''
    nextTick(() => inputRefs.value[0]?.focus())
  } finally {
    loading.value = false
  }
}

// Auto-submit when 4 chars entered
watch(code, (val) => {
  if (val.length === 4 && !loading.value) {
    handleSubmit()
  }
})

onMounted(() => {
  if (!token.value) {
    error.value = 'Invalid or missing token'
    return
  }
  nextTick(() => inputRefs.value[0]?.focus())
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <span class="text-lg font-semibold tracking-tight">Context</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="min-h-screen flex items-center justify-center px-6 pt-16">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 text-center">

          <!-- No token -->
          <template v-if="!token">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-50 flex items-center justify-center">
              <Icon name="heroicons:exclamation-triangle" class="w-8 h-8 text-rose-500" />
            </div>
            <h1 class="text-xl font-semibold text-slate-900 mb-2">Invalid link</h1>
            <p class="text-slate-500 mb-8">This magic link appears to be invalid or incomplete.</p>
            <NuxtLink
              to="/login"
              class="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-all"
            >
              <span>Request a new link</span>
              <Icon name="heroicons:arrow-right" class="w-5 h-5" />
            </NuxtLink>
          </template>

          <!-- Verified success -->
          <template v-else-if="verified">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Icon name="heroicons:check-circle" class="w-8 h-8 text-emerald-500" />
            </div>
            <h1 class="text-xl font-semibold text-slate-900 mb-2">You're signed in</h1>
            <p class="text-slate-500">Redirecting to your workspace...</p>
          </template>

          <!-- Code input -->
          <template v-else>
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
              <Icon name="heroicons:shield-check" class="w-8 h-8 text-violet-500" />
            </div>
            <h1 class="text-xl font-semibold text-slate-900 mb-2">Enter verification code</h1>
            <p class="text-slate-500 mb-8">We sent a 4-character code to your email. Enter it below to sign in.</p>

            <form @submit.prevent="handleSubmit">
              <!-- 4-digit code inputs -->
              <div class="flex justify-center gap-3 mb-6">
                <input
                  v-for="i in 4"
                  :key="i"
                  :ref="(el) => setInputRef(el, i - 1)"
                  type="text"
                  :value="codeDigits[i - 1] || ''"
                  maxlength="4"
                  class="w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all outline-none uppercase font-mono"
                  :class="error
                    ? 'border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100'
                    : 'border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100'"
                  @input="handleInput(i - 1, $event)"
                  @keydown="handleKeydown(i - 1, $event)"
                  @paste="handlePaste"
                  :disabled="loading"
                />
              </div>

              <!-- Error message -->
              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="opacity-0 translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
              >
                <div v-if="error" class="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <div class="flex items-center gap-2 justify-center">
                    <Icon name="heroicons:exclamation-circle" class="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <p class="text-sm text-rose-700">{{ error }}</p>
                  </div>
                </div>
              </Transition>

              <!-- Submit button -->
              <button
                type="submit"
                :disabled="code.length !== 4 || loading"
                class="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon v-if="loading" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
                <template v-else>
                  <span>Verify and sign in</span>
                  <Icon name="heroicons:arrow-right" class="w-5 h-5" />
                </template>
              </button>
            </form>
          </template>
        </div>

        <p class="text-center text-sm text-slate-400 mt-8">
          Codes expire after 1 hour for security.
        </p>
      </div>
    </div>
  </div>
</template>
