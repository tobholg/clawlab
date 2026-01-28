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
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-6">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex items-center justify-center text-3xl mb-10">
        <span class="text-relai-600 font-bold">Relai</span>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div class="mb-8">
          <h1 class="text-xl font-semibold text-gray-900 mb-2">Welcome</h1>
          <p class="text-sm text-gray-500">
            Enter your email to receive a magic link
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">
              Email
            </label>
            <input
              v-model="email"
              type="email"
              name="email"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-relai-400 focus:ring-2 focus:ring-relai-100 outline-none bg-white text-gray-900 placeholder-gray-400 transition-all"
              placeholder="you@example.com"
              required
              :disabled="success"
            />
          </div>

          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 bg-relai-600 text-white py-3 rounded-xl hover:bg-relai-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="loading || success"
          >
            <Icon v-if="loading" name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
            <span>{{ loading ? 'Sending...' : success ? 'Check your email' : 'Continue' }}</span>
            <Icon v-if="!loading && !success" name="heroicons:arrow-right" class="w-5 h-5" />
          </button>
        </form>

        <!-- Status messages -->
        <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
          <p class="text-sm text-red-600 text-center">{{ error }}</p>
        </div>
        <div v-else-if="success" class="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl">
          <p class="text-sm text-green-700 text-center">
            Check your email for the magic link ✨
          </p>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-xs text-gray-400 mt-6">
        No password needed. We'll email you a link.
      </p>
    </div>
  </div>
</template>
