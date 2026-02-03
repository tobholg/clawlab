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
const openSpace = (slug: string) => {
  router.push(`/s/${slug}`)
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
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/dashboard" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Icon name="heroicons:globe-alt" class="w-4 h-4 text-white" />
          </div>
          <span class="text-lg font-semibold tracking-tight">Stakeholder Portal</span>
        </NuxtLink>
        
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <div class="w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center">
              <span class="text-xs font-medium text-slate-600">
                {{ user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?' }}
              </span>
            </div>
            <span class="text-sm text-slate-600">{{ user?.name || user?.email }}</span>
          </div>
          <button
            @click="logout"
            class="text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
          <h1 class="text-2xl font-semibold text-slate-900 mb-2">My Portals</h1>
          <p class="text-slate-500">Access your stakeholder portals and track project updates</p>
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
          <div class="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:inbox" class="w-8 h-8 text-violet-500" />
          </div>
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
            @click="openSpace(space.slug)"
            class="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/50 transition-all group"
          >
            <!-- Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                  <Icon name="heroicons:globe-alt" class="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 class="font-medium text-slate-900 group-hover:text-violet-700 transition-colors">
                    {{ space.name }}
                  </h3>
                  <p class="text-sm text-slate-500">{{ space.project.title }}</p>
                </div>
              </div>
              <Icon 
                name="heroicons:arrow-right" 
                class="w-5 h-5 text-slate-300 group-hover:text-violet-500 transition-colors" 
              />
            </div>

            <!-- Description -->
            <p v-if="space.description" class="text-sm text-slate-600 mb-4 line-clamp-2">
              {{ space.description }}
            </p>

            <!-- Stats -->
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-1.5 text-slate-500">
                <Icon name="heroicons:chat-bubble-left-right" class="w-3.5 h-3.5" />
                <span>{{ space.stats.pendingIRs }} pending</span>
              </div>
              <div class="flex items-center gap-1.5 text-slate-500">
                <Icon name="heroicons:document-text" class="w-3.5 h-3.5" />
                <span>{{ space.stats.myRequests }} requests</span>
              </div>
              <div class="flex-1"></div>
              <span class="text-slate-400">Joined {{ formatDate(space.joinedAt) }}</span>
            </div>
          </button>
        </div>

        <!-- CTA: Use Relai for your team -->
        <div class="mt-12 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-center">
          <h2 class="text-xl font-semibold text-white mb-2">
            Want Relai for your own team?
          </h2>
          <p class="text-slate-300 mb-6 max-w-md mx-auto">
            Create your own workspace and invite your clients, investors, and partners to their own stakeholder portals.
          </p>
          <NuxtLink
            to="/onboarding"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            Get Started
            <Icon name="heroicons:arrow-right" class="w-4 h-4" />
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>
