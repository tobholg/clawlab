<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'guest',
})

const route = useRoute()
const selectedPlan = computed(() => {
  return (route.query.plan as string)?.toUpperCase() === 'PRO' ? 'PRO' : 'FREE'
})
const isPro = computed(() => selectedPlan.value === 'PRO')

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

// Pro seat selection — seed from query params (landing page calculator) or default to 10/5
const { calculateSeatCost, getSeatBreakdown, SEAT_TIERS } = usePricing()
const defaultInternal = Math.max(1, Math.min(100, Number(route.query.seats) || 10))
const defaultExternal = Math.max(0, Math.min(100, Number(route.query.ext) || 5))
const internalSeatCount = ref(defaultInternal)
const externalSeatCount = ref(defaultExternal)

const internalCost = computed(() => calculateSeatCost(internalSeatCount.value, 'INTERNAL'))
const externalCost = computed(() => externalSeatCount.value > 0 ? calculateSeatCost(externalSeatCount.value, 'EXTERNAL') : 0)
const totalMonthlyCost = computed(() => internalCost.value + externalCost.value)
const internalBreakdown = computed(() => getSeatBreakdown(internalSeatCount.value, 'INTERNAL'))
const externalBreakdown = computed(() => externalSeatCount.value > 0 ? getSeatBreakdown(externalSeatCount.value, 'EXTERNAL') : [])

// Savings vs flat-rate pricing (same logic as landing page calculator)
const fullPrice = computed(() =>
  internalSeatCount.value * SEAT_TIERS.INTERNAL.prices[0]! + externalSeatCount.value * SEAT_TIERS.EXTERNAL.prices[0]!
)
const savingsAmount = computed(() => fullPrice.value - totalMonthlyCost.value)
const savingsPct = computed(() => {
  if (fullPrice.value <= 0 || totalMonthlyCost.value >= fullPrice.value) return 0
  return ((fullPrice.value - totalMonthlyCost.value) / fullPrice.value) * 100
})

// Dynamic steps: Free = 4, Pro = 5 (adds Plan step at position 4)
const totalSteps = computed(() => isPro.value ? 5 : 4)
const inviteStep = computed(() => isPro.value ? 5 : 4)

// Auto-generate slug from org name
watch(orgName, (name) => {
  orgSlug.value = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
})

// Truncate team emails if user reduces Pro seat count
watch(internalSeatCount, (count) => {
  if (isPro.value) {
    const max = Math.max(0, count - 1)
    if (teamEmails.value.length > max && max > 0) {
      teamEmails.value = teamEmails.value.slice(0, max)
    }
  }
})

// Step validation
const isStep1Valid = computed(() => orgName.value.trim().length >= 2)
const isStep2Valid = computed(() => workspaceName.value.trim().length >= 2)
const isStep3Valid = computed(() =>
  userName.value.trim().length >= 2 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.value)
)
const isStep4ProPlanValid = computed(() =>
  internalSeatCount.value >= 1 && internalSeatCount.value <= 100 &&
  externalSeatCount.value >= 0 && externalSeatCount.value <= 100
)

const canProceed = computed(() => {
  if (currentStep.value === 1) return isStep1Valid.value
  if (currentStep.value === 2) return isStep2Valid.value
  if (currentStep.value === 3) return isStep3Valid.value
  if (isPro.value && currentStep.value === 4) return isStep4ProPlanValid.value
  if (currentStep.value === inviteStep.value) return true // Team invite is optional
  return false
})

const nextStep = () => {
  if (canProceed.value && currentStep.value < totalSteps.value) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// Invite limit based on plan
const maxInvites = computed(() => {
  if (isPro.value) return Math.max(0, internalSeatCount.value - 1)
  return 4 // FREE: 5 seats - 1 owner
})

// Team email management
const addEmailField = () => {
  if (teamEmails.value.length < maxInvites.value) {
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
        ...(isPro.value && {
          planTier: 'PRO',
          seatSelection: {
            internal: internalSeatCount.value,
            external: externalSeatCount.value,
          },
        }),
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

const stepIndicators = computed(() => {
  const base = [
    { step: 1, label: 'Organization', hint: 'Name your company and choose a URL.' },
    { step: 2, label: 'Workspace', hint: 'Create the first space for your team.' },
    { step: 3, label: 'Profile', hint: 'Tell us who will own the workspace.' },
  ]
  if (isPro.value) {
    base.push({ step: 4, label: 'Plan', hint: 'Choose your seat configuration.' })
    base.push({ step: 5, label: 'Team', hint: 'Invite teammates and load demo data.' })
  } else {
    base.push({ step: 4, label: 'Team', hint: 'Invite teammates and load demo data.' })
  }
  return base
})

const progressWidth = computed(() => `${(currentStep.value / totalSteps.value) * 100}%`)

onMounted(() => {
  requestAnimationFrame(() => {
    pageReady.value = true
  })
})
</script>

<template>
  <div class="clawlab-onboarding min-h-screen text-slate-900" :class="{ 'is-ready': pageReady }">
    <!-- Header -->
    <nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-100 intro" style="--d: 0ms">
      <div class="w-full px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <span class="text-lg font-semibold tracking-tight">ClawLab</span>
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
    <main class="relative min-h-screen flex flex-col px-6 pt-24 pb-10">
        <div class="max-w-6xl mx-auto w-full my-auto grid lg:grid-cols-[0.95fr,1.05fr] gap-10 xl:gap-16 items-center">
        <!-- Left Column -->
        <aside>
          <h1 class="text-3xl sm:text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">
            <span class="word-animate" style="--d: 160ms">Build</span>
            <span class="word-animate" style="--d: 220ms">your</span>
            <span class="word-animate word-animate--accent" style="--d: 280ms">workspace</span>
            <span class="word-animate" style="--d: 340ms">in minutes.</span>
          </h1>

          <p class="mt-4 text-base text-slate-600 max-w-xl intro" style="--d: 420ms">
            Set up your organization, create the first workspace, and invite your team.
          </p>

          <div class="mt-6 space-y-2 intro" style="--d: 520ms">
            <div
              v-for="indicator in stepIndicators"
              :key="indicator.step"
              :class="[
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all',
                currentStep >= indicator.step
                  ? 'bg-white/90 border-slate-200 shadow-sm'
                  : 'bg-white/60 border-slate-100'
              ]"
            >
              <div
                :class="[
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors flex-shrink-0',
                  currentStep > indicator.step
                    ? 'bg-slate-900 text-white'
                    : currentStep === indicator.step
                      ? 'bg-slate-900/90 text-white'
                      : 'bg-slate-100 text-slate-400'
                ]"
              >
                <Icon v-if="currentStep > indicator.step" name="heroicons:check" class="w-3.5 h-3.5" />
                <span v-else>{{ indicator.step }}</span>
              </div>
              <div>
                <div :class="['text-sm font-medium', currentStep >= indicator.step ? 'text-slate-900' : 'text-slate-400']">
                  {{ indicator.label }}
                </div>
                <p v-if="currentStep === indicator.step" class="text-xs text-slate-500 mt-0.5">{{ indicator.hint }}</p>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-sm intro hide-short" style="--d: 620ms">
            Your data stays private. Add teammates now or later.
          </div>
        </aside>

        <!-- Form Card -->
        <section class="relative lg:self-center">
          <div class="onboarding-card intro" style="--d: 220ms">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Step {{ currentStep }} of {{ totalSteps }}</span>
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
                    <span class="px-3 py-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl text-slate-400 text-sm">claw-lab.ai/</span>
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

            <!-- Step 4 (Pro only): Choose your plan -->
            <div v-if="isPro && currentStep === 4" class="space-y-6">
              <div class="text-center">
                <div class="w-12 h-12 bg-gradient-to-br from-emerald-100 to-sky-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="heroicons:credit-card" class="w-6 h-6 text-emerald-600" />
                </div>
                <h2 class="text-xl font-semibold text-slate-900 mb-2">Configure your seats</h2>
                <p class="text-slate-500 text-sm">Choose how many seats you need. Volume discounts apply automatically.</p>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">Internal seats</label>
                  <p class="text-xs text-slate-400 mb-2">For your core team members who manage projects.</p>
                  <input
                    v-model.number="internalSeatCount"
                    type="number"
                    min="1"
                    max="100"
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all tabular-nums"
                  />
                  <div v-if="internalBreakdown.length > 0" class="mt-2 space-y-1">
                    <div v-for="line in internalBreakdown" :key="line.bracket.min" class="flex items-center justify-between text-xs text-slate-500">
                      <span>{{ line.count }} seat{{ line.count > 1 ? 's' : '' }} @ ${{ line.rate }}/mo</span>
                      <span class="font-medium text-slate-700">${{ line.subtotal }}/mo</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5">External seats <span class="text-slate-400 font-normal">(optional)</span></label>
                  <p class="text-xs text-slate-400 mb-2">For stakeholders, clients, or partners with limited access.</p>
                  <input
                    v-model.number="externalSeatCount"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-400 transition-all tabular-nums"
                  />
                  <div v-if="externalBreakdown.length > 0" class="mt-2 space-y-1">
                    <div v-for="line in externalBreakdown" :key="line.bracket.min" class="flex items-center justify-between text-xs text-slate-500">
                      <span>{{ line.count }} seat{{ line.count > 1 ? 's' : '' }} @ ${{ line.rate }}/mo</span>
                      <span class="font-medium text-slate-700">${{ line.subtotal }}/mo</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-700">Monthly total</span>
                  <span class="text-xl font-bold text-slate-900 tabular-nums">${{ totalMonthlyCost }}/mo</span>
                </div>
                <div v-if="savingsPct > 0" class="flex items-center justify-between mt-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Save {{ savingsPct.toFixed(0) }}%
                    </span>
                    <span class="text-xs text-slate-400 line-through tabular-nums">${{ fullPrice }}/mo</span>
                  </div>
                  <span class="text-xs text-emerald-600 font-medium tabular-nums">${{ savingsAmount }}/mo saved</span>
                </div>
                <p class="text-xs text-slate-400 mt-2">Volume discounts applied automatically. You'll set up billing after onboarding.</p>
              </div>
            </div>

            <!-- Invite Team step (step 4 for Free, step 5 for Pro) -->
            <div v-if="currentStep === inviteStep" class="space-y-6">
              <div class="text-center">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="heroicons:user-plus" class="w-6 h-6 text-blue-600" />
                </div>
                <h2 class="text-xl font-semibold text-slate-900 mb-2">Invite your team</h2>
                <p class="text-slate-500 text-sm">Add teammates to collaborate with. You can skip this for now.</p>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="block text-sm font-medium text-slate-700">Team member emails</label>
                  <span class="text-xs text-slate-400">Up to {{ maxInvites }} invite{{ maxInvites !== 1 ? 's' : '' }}</span>
                </div>

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
                  v-if="teamEmails.length < maxInvites"
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
                v-if="currentStep < totalSteps"
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
    </main>
  </div>
</template>

<style scoped>
.clawlab-onboarding {
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

@media (max-height: 750px) {
  .hide-short {
    display: none;
  }
}
</style>
