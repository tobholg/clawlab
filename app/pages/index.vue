<script setup lang="ts">
definePageMeta({
  layout: false,
})

const features = [
  {
    icon: 'heroicons:sparkles',
    title: 'AI-Powered Insights',
    description: 'Intelligent progress tracking that predicts completion dates and identifies risks before they become blockers.',
  },
  {
    icon: 'heroicons:calendar',
    title: 'Smart Scheduling',
    description: 'Automatic timeline adjustments based on team velocity, dependencies, and historical patterns.',
  },
  {
    icon: 'heroicons:users',
    title: 'Team Coordination',
    description: 'Keep everyone aligned with clear ownership, real-time updates, and stakeholder visibility.',
  },
  {
    icon: 'heroicons:squares-2x2',
    title: 'Recursive Tasks',
    description: 'Break work down infinitely. Projects contain tasks contain subtasks — all with the same powerful features.',
  },
]
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <span class="text-white text-sm font-semibold">R</span>
          </div>
          <span class="text-lg font-semibold tracking-tight">Relai</span>
        </div>
        
        <div class="flex items-center gap-4">
          <NuxtLink 
            to="/login" 
            class="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign in
          </NuxtLink>
          <NuxtLink 
            to="/onboarding" 
            class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="pt-32 pb-20 px-6">
      <div class="max-w-4xl mx-auto text-center">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 mb-8">
          <Icon name="heroicons:sparkles" class="w-4 h-4 text-violet-500" />
          <span class="text-sm font-medium text-violet-700">Powered by AI</span>
        </div>
        
        <!-- Headline -->
        <h1 class="text-5xl sm:text-6xl font-semibold text-slate-900 leading-tight tracking-tight mb-6">
          Project management that
          <span class="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">thinks ahead</span>
        </h1>
        
        <!-- Subheadline -->
        <p class="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI-powered progress tracking, intelligent scheduling, and team coordination that actually works. 
          Stop managing spreadsheets — start shipping.
        </p>
        
        <!-- CTA Buttons -->
        <div class="flex items-center justify-center gap-4">
          <NuxtLink 
            to="/onboarding"
            class="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all hover:scale-[1.02] shadow-lg shadow-slate-900/10"
          >
            <span>Get Started Free</span>
            <Icon name="heroicons:arrow-right" class="w-4 h-4" />
          </NuxtLink>
          <a 
            href="#features"
            class="inline-flex items-center gap-2 px-6 py-3 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            <span>Learn More</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Visual Preview -->
    <section class="pb-20 px-6">
      <div class="max-w-5xl mx-auto">
        <div class="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shadow-slate-200/50 bg-gradient-to-br from-slate-50 to-white">
          <!-- Browser Chrome -->
          <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white/50">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-rose-400" />
              <div class="w-3 h-3 rounded-full bg-amber-400" />
              <div class="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div class="flex-1 mx-8">
              <div class="max-w-md mx-auto h-6 bg-slate-100 rounded-md" />
            </div>
          </div>
          
          <!-- App Preview Mockup -->
          <div class="aspect-video bg-gradient-to-br from-slate-50 via-white to-slate-50 p-8">
            <div class="h-full flex gap-6">
              <!-- Sidebar Mock -->
              <div class="w-48 bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 bg-slate-900 rounded-md" />
                  <div class="h-4 w-16 bg-slate-200 rounded" />
                </div>
                <div class="space-y-2 mt-6">
                  <div class="h-8 bg-slate-100 rounded-lg" />
                  <div class="h-8 bg-slate-50 rounded-lg" />
                  <div class="h-8 bg-slate-50 rounded-lg" />
                </div>
              </div>
              
              <!-- Main Content Mock -->
              <div class="flex-1 bg-white rounded-xl border border-slate-100 p-6">
                <div class="flex items-center justify-between mb-6">
                  <div class="h-6 w-32 bg-slate-200 rounded" />
                  <div class="h-8 w-24 bg-slate-900 rounded-lg" />
                </div>
                
                <!-- Kanban Mock -->
                <div class="flex gap-4 h-[calc(100%-3rem)]">
                  <div class="flex-1 bg-slate-50 rounded-lg p-3 space-y-2">
                    <div class="h-4 w-16 bg-slate-200 rounded mb-3" />
                    <div class="h-20 bg-white rounded-lg border border-slate-100" />
                    <div class="h-16 bg-white rounded-lg border border-slate-100" />
                  </div>
                  <div class="flex-1 bg-blue-50/50 rounded-lg p-3 space-y-2">
                    <div class="h-4 w-20 bg-blue-100 rounded mb-3" />
                    <div class="h-24 bg-white rounded-lg border border-blue-100" />
                  </div>
                  <div class="flex-1 bg-emerald-50/50 rounded-lg p-3 space-y-2">
                    <div class="h-4 w-12 bg-emerald-100 rounded mb-3" />
                    <div class="h-16 bg-white rounded-lg border border-emerald-100" />
                    <div class="h-20 bg-white rounded-lg border border-emerald-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-semibold text-slate-900 mb-4">
            Everything you need to ship faster
          </h2>
          <p class="text-lg text-slate-500 max-w-xl mx-auto">
            Built for teams who care about execution, not ceremony.
          </p>
        </div>
        
        <div class="grid md:grid-cols-2 gap-6">
          <div 
            v-for="feature in features"
            :key="feature.title"
            class="p-6 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-100 transition-all"
          >
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mb-4">
              <Icon :name="feature.icon" class="w-5 h-5 text-violet-600" />
            </div>
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{{ feature.title }}</h3>
            <p class="text-slate-500 leading-relaxed">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20 px-6">
      <div class="max-w-3xl mx-auto text-center">
        <h2 class="text-3xl font-semibold text-slate-900 mb-4">
          Ready to transform how you manage projects?
        </h2>
        <p class="text-lg text-slate-500 mb-8">
          Get started in minutes. No credit card required.
        </p>
        <NuxtLink 
          to="/onboarding"
          class="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all hover:scale-[1.02] shadow-lg shadow-slate-900/10 text-lg"
        >
          <span>Start Your Free Workspace</span>
          <Icon name="heroicons:arrow-right" class="w-5 h-5" />
        </NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-slate-100 py-8 px-6">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center">
            <span class="text-white text-xs font-semibold">R</span>
          </div>
          <span class="text-sm text-slate-500">© 2025 Relai</span>
        </div>
        <div class="flex items-center gap-6 text-sm text-slate-500">
          <a href="#" class="hover:text-slate-900 transition-colors">Privacy</a>
          <a href="#" class="hover:text-slate-900 transition-colors">Terms</a>
          <a href="#" class="hover:text-slate-900 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  </div>
</template>
