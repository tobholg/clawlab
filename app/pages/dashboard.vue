<script setup lang="ts">
definePageMeta({
  layout: false
})

const router = useRouter()
const { user, isAuthenticated, fetchUser, logout } = useAuth()

// Stakeholder spaces data
const loading = ref(true)
const error = ref('')
const spaces = ref<Array<{
  id: string
  name: string
  slug: string
  description?: string
  project: {
    id: string
    title: string
    description?: string
  }
  stats: {
    pendingIRs: number
    myRequests: number
  }
  joinedAt: string
}>>([])

// Fetch stakeholder spaces
const fetchSpaces = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const data = await $fetch('/api/stakeholder/spaces')
    spaces.value = data as any
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to load spaces'
  } finally {
    loading.value = false
  }
}

// Navigate to space portal
const openSpace = (id: string, slug: string) => {
  router.push(`/s/${id}/${slug}`)
}

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Check auth and fetch spaces on mount
onMounted(async () => {
  await fetchUser()
  if (!isAuthenticated.value) {
    router.push('/login?redirect=/dashboard')
    return
  }
  await fetchSpaces()
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-5xl mx-auto h-16 flex items-center justify-between">
        <NuxtLink to="/dashboard" class="flex items-baseline gap-2">
          <span class="text-lg font-semibold tracking-tight text-slate-900">ClawLab</span>
          <span class="text-sm text-slate-400">Portals</span>
        </NuxtLink>
        
        <div class="flex items-center gap-4">
          <span class="hidden sm:block max-w-[220px] truncate text-sm text-slate-500">{{ user?.name || user?.email }}</span>
          <button
            @click="logout"
            class="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="pt-24 pb-12 px-6">
      <div class="max-w-5xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-slate-900 mb-2">Portals</h1>
          <p class="text-slate-500">Projects shared with you</p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-violet-500 animate-spin" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-rose-50 border border-rose-100 rounded-xl p-6 text-center">
          <Icon name="heroicons:exclamation-circle" class="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p class="text-rose-700">{{ error }}</p>
          <button 
            @click="fetchSpaces" 
            class="mt-4 text-sm text-rose-600 hover:text-rose-700 font-medium"
          >
            Try again
          </button>
        </div>

        <!-- Empty State -->
        <div v-else-if="spaces.length === 0" class="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Icon name="heroicons:inbox" class="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <h2 class="text-lg font-medium text-slate-900 mb-2">No portals yet</h2>
          <p class="text-slate-500 mb-6 max-w-sm mx-auto">
            You'll see your stakeholder portals here once you've been invited to one.
          </p>
          <NuxtLink 
            to="/"
            class="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            Back to home
          </NuxtLink>
        </div>

        <!-- Spaces Grid -->
        <div v-else class="grid gap-4 md:grid-cols-2">
          <button
            v-for="space in spaces"
            :key="space.id"
            @click="openSpace(space.id, space.slug)"
            class="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 hover:bg-slate-50/60 transition-all group"
          >
            <!-- Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="min-w-0">
                <h3 class="font-medium text-slate-900 group-hover:text-slate-950 transition-colors">
                  {{ space.name }}
                </h3>
                <p class="text-sm text-slate-500 truncate">{{ space.project.title }}</p>
              </div>
              <Icon
                name="heroicons:arrow-right"
                class="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
              />
            </div>

            <!-- Description -->
            <p v-if="space.description" class="text-sm text-slate-600 mb-4 line-clamp-2">
              {{ space.description }}
            </p>

            <!-- Stats -->
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <span>{{ space.stats.pendingIRs }} pending</span>
              <span class="text-slate-300">·</span>
              <span>{{ space.stats.myRequests }} requests</span>
              <span class="text-slate-300">·</span>
              <span class="text-slate-400">Joined {{ formatDate(space.joinedAt) }}</span>
            </div>
          </button>
        </div>

        <!-- CTA: Use ClawLab for your team -->
        <div class="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold text-slate-900">
                Want ClawLab for your own team?
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Create a workspace and invite clients, investors, and partners to their own portals.
              </p>
            </div>
            <NuxtLink
              to="/onboarding"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Get started
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
