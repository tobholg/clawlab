<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'guest',
})

const currentStep = ref(1)
const isSubmitting = ref(false)
const error = ref('')
const pageReady = ref(false)

// Form data
const orgName = ref('')
const orgSlug = ref('')
const workspaceName = ref('')
const workspaceDescription = ref('')
const userName = ref('')
const userEmail = ref('')
const loadDemoData = ref(true) // Default checked
const teamEmails = ref<string[]>(['']) // Start with one empty field

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
const isStep4Valid = computed(() => true) // Team invite is optional

const canProceed = computed(() => {
  if (currentStep.value === 1) return isStep1Valid.value
  if (currentStep.value === 2) return isStep2Valid.value
  if (currentStep.value === 3) return isStep3Valid.value
  if (currentStep.value === 4) return isStep4Valid.value
  return false
})

const nextStep = () => {
  if (canProceed.value && currentStep.value < 4) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// Team email management
const addEmailField = () => {
  if (teamEmails.value.length < 10) {
    teamEmails.value.push('')
  }
}

const removeEmailField = (index: number) => {
  if (teamEmails.value.length > 1) {
    teamEmails.value.splice(index, 1)
  }
}

const validTeamEmails = computed(() => {
  return teamEmails.value
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== userEmail.value.trim().toLowerCase())
})

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
        teamEmails: validTeamEmails.value,
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
  { step: 1, label: 'Organization', hint: 'Name your company and choose a URL.' },
  { step: 2, label: 'Workspace', hint: 'Create the first space for your team.' },
  { step: 3, label: 'Profile', hint: 'Tell us who will own the workspace.' },
  { step: 4, label: 'Team', hint: 'Invite teammates and load demo data.' },
]

const progressWidth = computed(() => `${(currentStep.value / stepIndicators.length) * 100}%`)

onMounted(() => {
  requestAnimationFrame(() => {
    pageReady.value = true
  })
})
</script>

<template>
  <div class="relai-onboarding min-h-screen text-slate-900" :class="{ 'is-ready': pageReady }">
    <!-- Header -->
    <nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-100 intro" style="--d: 0ms">
      <div class="w-full px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <span class="text-white text-sm font-semibold">R</span>
          </div>
          <span class="text-lg font-semibold tracking-tight">Relai</span>
        </NuxtLink>
        <div class="flex items-center gap-4">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 text-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all bg-white/70"
          >
            <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            <span>Back to home</span>
          </NuxtLink>
          <NuxtLink to="/login" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Sign in
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="relative min-h-screen flex items-center px-6">
      <div class="w-full py-16">
        <div class="max-w-6xl mx-auto grid lg:grid-cols-[0.95fr,1.05fr] gap-12 xl:gap-16 items-center">
        <!-- Left Column -->
        <aside>
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 text-xs font-semibold text-slate-600 intro" style="--d: 120ms">
            <span class="w-2 h-2 rounded-full bg-sky-400" />
            <span>Guided setup</span>
          </div>

          <h1 class="mt-6 text-4xl sm:text-5xl xl:text-6xl font-semibold leading-tight tracking-tight">
            <span class="word-animate" style="--d: 160ms">Build</span>
            <span class="word-animate" style="--d: 220ms">your</span>
            <span class="word-animate word-animate--accent" style="--d: 280ms">workspace</span>
            <span class="word-animate" style="--d: 340ms">in minutes.</span>
          </h1>

          <p class="mt-6 text-lg text-slate-600 max-w-xl intro" style="--d: 420ms">
            Set up your organization, create the first workspace, and invite your team. Most teams finish in under
            five minutes.
          </p>

          <div class="mt-10 space-y-4 intro" style="--d: 520ms">
            <div
              v-for="indicator in stepIndicators"
              :key="indicator.step"
              :class="[
                'flex items-start gap-3 p-4 rounded-2xl border transition-all',
                currentStep >= indicator.step
                  ? 'bg-white/90 border-slate-200 shadow-lg shadow-slate-200/40'
                  : 'bg-white/60 border-slate-100'
              ]"
            >
              <div
                :class="[
                  'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-colors',
                  currentStep > indicator.step
                    ? 'bg-slate-900 text-white'
                    : currentStep === indicator.step
                      ? 'bg-slate-900/90 text-white'
                      : 'bg-slate-100 text-slate-400'
                ]"
              >
                <Icon v-if="currentStep > indicator.step" name="heroicons:check" class="w-4 h-4" />
                <span v-else>{{ indicator.step }}</span>
              </div>
              <div>
                <div :class="['text-sm font-semibold', currentStep >= indicator.step ? 'text-slate-900' : 'text-slate-500']">
                  {{ indicator.label }}
                </div>
                <p class="text-xs text-slate-500 mt-1">{{ indicator.hint }}</p>
              </div>
            </div>
          </div>

          <div class="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600 shadow-lg shadow-slate-200/40 intro" style="--d: 620ms">
            Your data stays private. Invite collaborators when you are ready, or start solo and add teammates later.
          </div>
        </aside>

        <!-- Form Card -->
        <section class="relative lg:self-center">
          <div class="onboarding-card intro" style="--d: 220ms">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Step {{ currentStep }} of {{ stepIndicators.length }}</span>
              <span>{{ stepIndicators[currentStep - 1]?.label }}</span>
            </div>
            <div class="mt-4 mb-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-slate-900 transition-all duration-500" :style="{ width: progressWidth }" />
            </div>

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
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all"
                    @keyup.enter="nextStep"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">URL slug</label>
                  <div class="flex items-center">
                    <span class="px-3 py-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl text-slate-400 text-sm">relai.app/</span>
                    <input
                      v-model="orgSlug"
                      type="text"
                      placeholder="acme"
                      class="flex-1 px-4 py-3 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all"
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
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all"
                    @keyup.enter="nextStep"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Description <span class="text-slate-400 font-normal">(optional)</span></label>
                  <textarea
                    v-model="workspaceDescription"
                    placeholder="What's this workspace for?"
                    rows="3"
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all resize-none"
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
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                  <input
                    v-model="userEmail"
                    type="email"
                    placeholder="jane@acme.com"
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all"
                    @keyup.enter="nextStep"
                  />
                </div>
              </div>
            </div>

            <!-- Step 4: Invite Team -->
            <div v-if="currentStep === 4" class="space-y-6">
              <div class="text-center">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="heroicons:user-plus" class="w-6 h-6 text-blue-600" />
                </div>
                <h2 class="text-xl font-semibold text-slate-900 mb-2">Invite your team</h2>
                <p class="text-slate-500 text-sm">Add teammates to collaborate with. You can skip this for now.</p>
              </div>

              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-700">Team member emails</label>

                <div v-for="(email, index) in teamEmails" :key="index" class="flex items-center gap-2">
                  <input
                    v-model="teamEmails[index]"
                    type="email"
                    placeholder="teammate@company.com"
                    class="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all"
                    @keyup.enter="index === teamEmails.length - 1 ? addEmailField() : null"
                  />
                  <button
                    v-if="teamEmails.length > 1"
                    @click="removeEmailField(index)"
                    class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Icon name="heroicons:x-mark" class="w-5 h-5" />
                  </button>
                </div>

                <button
                  v-if="teamEmails.length < 10"
                  @click="addEmailField"
                  class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <Icon name="heroicons:plus" class="w-4 h-4" />
                  <span>Add another</span>
                </button>

                <p v-if="validTeamEmails.length > 0" class="text-xs text-emerald-600 mt-2">
                  {{ validTeamEmails.length }} teammate{{ validTeamEmails.length > 1 ? 's' : '' }} will be invited
                </p>
              </div>

              <!-- Demo Data Checkbox -->
              <div class="pt-4 border-t border-slate-100">
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
                    <p class="text-xs text-slate-400 mt-0.5">Start with sample projects, tasks, and team members.</p>
                  </div>
                </label>
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
                v-if="currentStep < 4"
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
                <span>{{ isSubmitting ? 'Creating...' : validTeamEmails.length > 0 ? 'Complete & Invite' : 'Complete Setup' }}</span>
                <Icon v-if="!isSubmitting" name="heroicons:check" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <p class="text-center text-sm text-slate-400 mt-6 intro" style="--d: 520ms">
            Already have an account?
            <NuxtLink to="/login" class="text-slate-600 hover:text-slate-900 underline">Sign in</NuxtLink>
          </p>
        </section>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.relai-onboarding {
  background-image:
    radial-gradient(60% 60% at 15% 10%, rgba(129, 140, 248, 0.16), rgba(129, 140, 248, 0)),
    linear-gradient(120deg, rgba(14, 165, 233, 0.16) 0%, rgba(255, 255, 255, 0.96) 45%),
    linear-gradient(300deg, rgba(16, 185, 129, 0.14) 0%, rgba(255, 255, 255, 0.96) 55%),
    linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
}

.onboarding-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.12), 0 10px 30px rgba(15, 23, 42, 0.06);
  padding: 32px;
  backdrop-filter: blur(10px);
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
  background-image: linear-gradient(120deg, #64748b, #94a3b8, #38bdf8);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

.is-ready .word-animate {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

@media (max-width: 640px) {
  .onboarding-card {
    padding: 26px;
  }
}

@media (min-width: 1280px) {
  .onboarding-card {
    padding: 36px;
  }
}
</style>
