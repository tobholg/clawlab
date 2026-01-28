<script setup lang="ts">
definePageMeta({
  layout: false,
})

const currentStep = ref(1)
const isSubmitting = ref(false)
const error = ref('')

// Form data
const orgName = ref('')
const orgSlug = ref('')
const workspaceName = ref('')
const workspaceDescription = ref('')
const userName = ref('')
const userEmail = ref('')
const loadDemoData = ref(process.env.NODE_ENV === 'development' || true) // Default checked in dev

// Auto-generate slug from org name
watch(orgName, (name) => {
  orgSlug.value = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
})

// Step validation
const isStep1Valid = computed(() => orgName.value.trim().length >= 2)
const isStep2Valid = computed(() => workspaceName.value.trim().length >= 2)
const isStep3Valid = computed(() => 
  userName.value.trim().length >= 2 && 
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.value)
)

const canProceed = computed(() => {
  if (currentStep.value === 1) return isStep1Valid.value
  if (currentStep.value === 2) return isStep2Valid.value
  if (currentStep.value === 3) return isStep3Valid.value
  return false
})

const nextStep = () => {
  if (canProceed.value && currentStep.value < 3) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const completeOnboarding = async () => {
  if (!canProceed.value || isSubmitting.value) return
  
  isSubmitting.value = true
  error.value = ''
  
  try {
    const response = await $fetch('/api/onboarding/complete', {
      method: 'POST',
      body: {
        organization: {
          name: orgName.value.trim(),
          slug: orgSlug.value.trim(),
        },
        workspace: {
          name: workspaceName.value.trim(),
          description: workspaceDescription.value.trim() || null,
        },
        user: {
          name: userName.value.trim(),
          email: userEmail.value.trim().toLowerCase(),
        },
        loadDemoData: loadDemoData.value,
      },
    })
    
    // Redirect to workspace
    await navigateTo('/workspace')
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Something went wrong. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

const stepIndicators = [
  { step: 1, label: 'Organization' },
  { step: 2, label: 'Workspace' },
  { step: 3, label: 'Profile' },
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col">
    <!-- Header -->
    <header class="p-6">
      <NuxtLink to="/" class="inline-flex items-center gap-2.5">
        <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
          <span class="text-white text-sm font-semibold">R</span>
        </div>
        <span class="text-lg font-semibold tracking-tight">Relai</span>
      </NuxtLink>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">
        <!-- Step Indicators -->
        <div class="flex items-center justify-center mb-10">
          <div class="flex items-center gap-3">
            <template v-for="(indicator, i) in stepIndicators" :key="indicator.step">
              <div class="flex items-center gap-2">
                <div 
                  :class="[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    currentStep >= indicator.step
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-400'
                  ]"
                >
                  <Icon 
                    v-if="currentStep > indicator.step" 
                    name="heroicons:check" 
                    class="w-4 h-4" 
                  />
                  <span v-else>{{ indicator.step }}</span>
                </div>
                <span 
                  :class="[
                    'text-sm font-medium transition-colors hidden sm:block',
                    currentStep >= indicator.step ? 'text-slate-900' : 'text-slate-400'
                  ]"
                >
                  {{ indicator.label }}
                </span>
              </div>
              <div 
                v-if="i < stepIndicators.length - 1"
                :class="[
                  'w-12 h-0.5 transition-colors',
                  currentStep > indicator.step ? 'bg-slate-900' : 'bg-slate-200'
                ]"
              />
            </template>
          </div>
        </div>

        <!-- Form Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8">
          <!-- Error Message -->
          <div 
            v-if="error" 
            class="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-start gap-3"
          >
            <Icon name="heroicons:exclamation-circle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{{ error }}</span>
          </div>
          
          <!-- Step 1: Organization -->
          <div v-if="currentStep === 1" class="space-y-6">
            <div class="text-center">
              <div class="w-12 h-12 bg-gradient-to-br from-violet-100 to-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon name="heroicons:building-office-2" class="w-6 h-6 text-violet-600" />
              </div>
              <h2 class="text-xl font-semibold text-slate-900 mb-2">Create your organization</h2>
              <p class="text-slate-500 text-sm">This is your team or company name.</p>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Organization name</label>
                <input
                  v-model="orgName"
                  type="text"
                  placeholder="Acme Inc."
                  class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  @keyup.enter="nextStep"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">URL slug</label>
                <div class="flex items-center">
                  <span class="px-3 py-2.5 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl text-slate-400 text-sm">relai.app/</span>
                  <input
                    v-model="orgSlug"
                    type="text"
                    placeholder="acme"
                    class="flex-1 px-4 py-2.5 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                    @keyup.enter="nextStep"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Workspace -->
          <div v-if="currentStep === 2" class="space-y-6">
            <div class="text-center">
              <div class="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon name="heroicons:folder" class="w-6 h-6 text-emerald-600" />
              </div>
              <h2 class="text-xl font-semibold text-slate-900 mb-2">Create your first workspace</h2>
              <p class="text-slate-500 text-sm">Workspaces help you organize different projects or teams.</p>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Workspace name</label>
                <input
                  v-model="workspaceName"
                  type="text"
                  placeholder="Product Development"
                  class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  @keyup.enter="nextStep"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Description <span class="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  v-model="workspaceDescription"
                  placeholder="What's this workspace for?"
                  rows="3"
                  class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <!-- Step 3: Profile -->
          <div v-if="currentStep === 3" class="space-y-6">
            <div class="text-center">
              <div class="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon name="heroicons:user" class="w-6 h-6 text-amber-600" />
              </div>
              <h2 class="text-xl font-semibold text-slate-900 mb-2">Your profile</h2>
              <p class="text-slate-500 text-sm">Let's set up your account.</p>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Your name</label>
                <input
                  v-model="userName"
                  type="text"
                  placeholder="Jane Smith"
                  class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                <input
                  v-model="userEmail"
                  type="email"
                  placeholder="jane@acme.com"
                  class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  @keyup.enter="completeOnboarding"
                />
              </div>
              
              <!-- Demo Data Checkbox -->
              <div class="pt-2">
                <label class="flex items-start gap-3 cursor-pointer group">
                  <div class="relative mt-0.5">
                    <input
                      v-model="loadDemoData"
                      type="checkbox"
                      class="sr-only peer"
                    />
                    <div class="w-5 h-5 border-2 border-slate-200 rounded-md peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-all group-hover:border-slate-300" />
                    <Icon 
                      name="heroicons:check" 
                      class="absolute inset-0 m-auto w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" 
                    />
                  </div>
                  <div>
                    <span class="text-sm font-medium text-slate-700">Load demo data</span>
                    <p class="text-xs text-slate-400 mt-0.5">Start with sample projects, tasks, and team members to explore the app.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Navigation Buttons -->
          <div class="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              v-if="currentStep > 1"
              @click="prevStep"
              class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Icon name="heroicons:arrow-left" class="w-4 h-4" />
              <span>Back</span>
            </button>
            <div v-else />
            
            <button
              v-if="currentStep < 3"
              @click="nextStep"
              :disabled="!canProceed"
              :class="[
                'flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                canProceed
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              ]"
            >
              <span>Continue</span>
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
            </button>
            
            <button
              v-else
              @click="completeOnboarding"
              :disabled="!canProceed || isSubmitting"
              :class="[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                canProceed && !isSubmitting
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              ]"
            >
              <Icon v-if="isSubmitting" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
              <span>{{ isSubmitting ? 'Creating...' : 'Complete Setup' }}</span>
              <Icon v-if="!isSubmitting" name="heroicons:check" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Footer Note -->
        <p class="text-center text-sm text-slate-400 mt-6">
          Already have an account? 
          <NuxtLink to="/login" class="text-slate-600 hover:text-slate-900 underline">Sign in</NuxtLink>
        </p>
      </div>
    </main>
  </div>
</template>
