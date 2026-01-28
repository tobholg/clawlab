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
    // Redirect to dashboard on success
    navigateTo('/')
  } catch (e: any) {
    error.value = e.data?.message || 'Invalid or expired magic link'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-6">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex items-center justify-center text-3xl mb-10">
        <span class="text-relai-600 font-bold">Relai</span>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <!-- Loading state -->
        <div v-if="loading">
          <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
          </div>
          <p class="text-gray-500">Verifying your link...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error">
          <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <Icon name="heroicons:exclamation-triangle" class="w-8 h-8 text-red-400" />
          </div>
          <h1 class="text-xl font-semibold text-gray-900 mb-2">Invalid link</h1>
          <p class="text-gray-500 mb-8">{{ error }}</p>

          <NuxtLink
            to="/login"
            class="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-relai-600 text-white hover:bg-relai-700 transition-all"
          >
            <span>Request a new link</span>
            <Icon name="heroicons:arrow-right" class="w-5 h-5" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
