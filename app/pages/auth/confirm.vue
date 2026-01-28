<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const { confirmMagicLink } = useAuth()

const loading = ref(true)
const error = ref('')

const token = computed(() => route.query.token as string | undefined)

onMounted(async () => {
  if (!token.value) {
    error.value = 'Invalid or missing token'
    loading.value = false
    return
  }

  try {
    await confirmMagicLink(token.value)
    // Redirect to workspace on success
    navigateTo('/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Invalid or expired magic link'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <span class="text-white text-sm font-semibold">R</span>
          </div>
          <span class="text-lg font-semibold tracking-tight">Relai</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="min-h-screen flex items-center justify-center px-6 pt-16">
      <div class="w-full max-w-md">
        <!-- Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 text-center">
          <!-- Loading state -->
          <div v-if="loading">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
              <Icon name="heroicons:arrow-path" class="w-8 h-8 text-violet-500 animate-spin" />
            </div>
            <h1 class="text-xl font-semibold text-slate-900 mb-2">Signing you in</h1>
            <p class="text-slate-500">Verifying your magic link...</p>
          </div>

          <!-- Error state -->
          <div v-else-if="error">
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-50 flex items-center justify-center">
              <Icon name="heroicons:exclamation-triangle" class="w-8 h-8 text-rose-500" />
            </div>
            <h1 class="text-xl font-semibold text-slate-900 mb-2">Link expired</h1>
            <p class="text-slate-500 mb-8">{{ error }}</p>

            <NuxtLink
              to="/login"
              class="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-all hover:scale-[1.01] shadow-lg shadow-slate-900/10"
            >
              <span>Request a new link</span>
              <Icon name="heroicons:arrow-right" class="w-5 h-5" />
            </NuxtLink>
          </div>
        </div>

        <!-- Footer hint -->
        <p class="text-center text-sm text-slate-400 mt-8">
          Magic links expire after 15 minutes for security.
        </p>
      </div>
    </div>
  </div>
</template>
