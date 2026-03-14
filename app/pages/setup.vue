<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'setup',
})

useHead({
  title: 'ClawLab — Setup',
})

const currentStep = ref(0)
const isSubmitting = ref(false)
const error = ref('')
const pageReady = ref(false)

// Mode: null until chosen
const mode = ref<'personal' | 'team' | null>(null)

// Form data
const orgName = ref('')
const orgSlug = ref('')
const workspaceName = ref('')
const userName = ref('')
const userEmail = ref('')
const userPassword = ref('')
const userPasswordConfirm = ref('')
const loadDemoData = ref(false)
const teamEmails = ref<string[]>([''])

const agentProviders = [
  { value: 'openclaw', label: 'OpenClaw' },
  { value: 'claude', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
  { value: 'custom', label: 'Custom' },
]

const agents = ref<Array<{ id: string; name: string; provider: string }>>([])
const agentName = ref('')
const agentProvider = ref('openclaw')
const agentFormError = ref('')
const generatedAgentKeys = ref<Array<{ id: string; name: string; provider: string; apiKey: string }>>([])
const copiedAgentKeyId = ref<string | null>(null)
const createLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Auto-generate slug from org name
watch(orgName, (name) => {
  orgSlug.value = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
})

// Step definitions per mode
const personalSteps = ['mode', 'profile', 'workspace', 'agents'] as const
const teamSteps = ['mode', 'organization', 'workspace', 'profile', 'invite', 'agents'] as const

const steps = computed(() => mode.value === 'team' ? teamSteps : personalSteps)
const totalSteps = computed(() => steps.value.length)
const currentStepKey = computed(() => steps.value[currentStep.value])
const progressWidth = computed(() => `${((currentStep.value + 1) / totalSteps.value) * 100}%`)

const stepIndicators = computed(() => {
  if (mode.value === 'team') {
    return [
      { key: 'mode', label: 'Mode', hint: 'Choose your setup type.', icon: 'heroicons:sparkles', color: 'emerald' },
      { key: 'organization', label: 'Organization', hint: 'Name your organization.', icon: 'heroicons:building-office-2', color: 'violet' },
      { key: 'workspace', label: 'Workspace', hint: 'Create the first workspace.', icon: 'heroicons:folder', color: 'emerald' },
      { key: 'profile', label: 'Profile', hint: 'Set up your account.', icon: 'heroicons:user', color: 'amber' },
      { key: 'invite', label: 'Team', hint: 'Invite teammates.', icon: 'heroicons:user-plus', color: 'blue' },
      { key: 'agents', label: 'Agents', hint: 'Configure AI agents.', icon: 'heroicons:cpu-chip', color: 'cyan' },
    ]
  }
  return [
    { key: 'mode', label: 'Mode', hint: 'Choose your setup type.', icon: 'heroicons:sparkles', color: 'emerald' },
    { key: 'profile', label: 'Profile', hint: 'Set up your account.', icon: 'heroicons:user', color: 'amber' },
    { key: 'workspace', label: 'Workspace', hint: 'Create the first workspace.', icon: 'heroicons:folder', color: 'emerald' },
    { key: 'agents', label: 'Agents', hint: 'Configure AI agents.', icon: 'heroicons:cpu-chip', color: 'cyan' },
  ]
})

// Validation
const isPasswordValid = computed(() =>
  userPassword.value.length >= 8 &&
  userPassword.value === userPasswordConfirm.value
)
const isProfileValid = computed(() => {
  const nameOk = userName.value.trim().length >= 2
  const passwordOk = isPasswordValid.value
  if (mode.value === 'team') {
    return nameOk && passwordOk && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.value)
  }
  // Personal: no email needed
  return nameOk && passwordOk
})
const isWorkspaceValid = computed(() => workspaceName.value.trim().length >= 2)
const isOrgValid = computed(() => orgName.value.trim().length >= 2 && orgSlug.value.trim().length >= 2)

const canProceed = computed(() => {
  const key = currentStepKey.value
  if (key === 'mode') return mode.value !== null
  if (key === 'profile') return isProfileValid.value
  if (key === 'workspace') return isWorkspaceValid.value
  if (key === 'organization') return isOrgValid.value
  if (key === 'invite') return true
  if (key === 'agents') return true
  return false
})

const selectMode = (m: 'personal' | 'team') => {
  mode.value = m
  nextTick(() => {
    currentStep.value = 1
    focusStepInput()
  })
}

const nextStep = () => {
  if (canProceed.value && currentStep.value < totalSteps.value - 1) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// Team email management
const maxInvites = 4

const addEmailField = () => {
  if (teamEmails.value.length < maxInvites) {
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

const addAgent = () => {
  const name = agentName.value.trim()
  if (!name) {
    agentFormError.value = 'Agent name is required'
    return
  }
  if (name.length > 80) {
    agentFormError.value = 'Agent name must be 80 characters or fewer'
    return
  }

  agentFormError.value = ''
  agents.value.push({
    id: createLocalId(),
    name,
    provider: agentProvider.value,
  })
  agentName.value = ''
  agentProvider.value = 'openclaw'
}

const removeAgent = (id: string) => {
  agents.value = agents.value.filter(agent => agent.id !== id)
}

const copyAgentKey = async (agentId: string, apiKey: string) => {
  try {
    await navigator.clipboard.writeText(apiKey)
    copiedAgentKeyId.value = agentId
    setTimeout(() => {
      copiedAgentKeyId.value = null
    }, 2000)
  } catch {
    // no-op
  }
}

const { clearSetupStatus } = useSetupStatus()

const finishSetup = async () => {
  clearSetupStatus()
  await navigateTo('/workspace')
}

const completeSetup = async () => {
  if (isSubmitting.value) return

  isSubmitting.value = true
  error.value = ''

  try {
    const result = await $fetch('/api/setup/complete', {
      method: 'POST',
      body: {
        mode: mode.value,
        user: {
          name: userName.value.trim(),
          password: userPassword.value,
          ...(mode.value === 'team' && { email: userEmail.value.trim().toLowerCase() }),
        },
        workspace: {
          name: workspaceName.value.trim(),
        },
        loadDemoData: loadDemoData.value,
        agents: agents.value.map((agent) => ({
          name: agent.name,
          provider: agent.provider,
        })),
        ...(mode.value === 'team' && {
          organization: {
            name: orgName.value.trim(),
            slug: orgSlug.value.trim(),
          },
          teamEmails: validTeamEmails.value,
        }),
      },
    }) as { agentApiKeys?: Array<{ id: string; name: string; provider: string; apiKey: string }> }

    generatedAgentKeys.value = Array.isArray(result?.agentApiKeys) ? result.agentApiKeys : []
    if (!generatedAgentKeys.value.length) {
      await finishSetup()
    }
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Something went wrong. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

// Icon gradient classes per color
const iconGradients: Record<string, string> = {
  emerald: 'from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20',
  violet: 'from-violet-100 to-blue-100 dark:from-violet-500/20 dark:to-blue-500/20',
  amber: 'from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20',
  blue: 'from-blue-100 to-indigo-100 dark:from-blue-500/20 dark:to-indigo-500/20',
  cyan: 'from-cyan-100 to-sky-100 dark:from-cyan-500/20 dark:to-sky-500/20',
}

const iconColors: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  violet: 'text-violet-600 dark:text-violet-400',
  amber: 'text-amber-600 dark:text-amber-400',
  blue: 'text-blue-600 dark:text-blue-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
}

// Focus first input on step change
function focusStepInput() {
  nextTick(() => {
    setTimeout(() => {
      const card = document.querySelector('.setup-card')
      if (!card) return
      const input = card.querySelector('input:not([type="checkbox"]):not([type="hidden"])') as HTMLInputElement | null
      input?.focus()
    }, 350) // after step transition
  })
}

watch(currentStep, () => focusStepInput())

onMounted(() => {
  requestAnimationFrame(() => {
    pageReady.value = true
  })
})
</script>

<template>
  <div class="clawlab-setup min-h-screen text-slate-900 dark:text-zinc-100" :class="{ 'is-ready': pageReady }">
    <!-- Background -->
    <div class="fixed inset-0 -z-10 setup-bg" aria-hidden="true" />

    <!-- Header -->
    <nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#050506]/80 border-b border-slate-100 dark:border-white/[0.06] intro" style="--d: 0ms">
      <div class="w-full px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-slate-900 dark:bg-white/[0.08] rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <span class="text-lg font-semibold tracking-tight">ClawLab</span>
        </div>
        <span class="text-sm text-slate-500 dark:text-zinc-500">Self-Hosted Setup</span>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="relative min-h-screen flex flex-col px-6 pt-24 pb-10">
      <div class="max-w-6xl mx-auto w-full my-auto grid lg:grid-cols-[0.95fr,1.05fr] gap-10 xl:gap-16 items-center">
        <!-- Left Column -->
        <aside>
          <h1 class="text-3xl sm:text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">
            <span class="word-animate" style="--d: 160ms">Set up</span>
            <span class="word-animate" style="--d: 220ms">your</span>
            <span class="word-animate word-animate--accent" style="--d: 280ms">instance</span>
            <span class="word-animate" style="--d: 340ms">in minutes.</span>
          </h1>

          <p class="mt-4 text-base text-slate-600 dark:text-zinc-400 max-w-xl intro" style="--d: 420ms">
            Create your admin account, configure a workspace, and start managing projects.
          </p>

          <div class="mt-6 space-y-2 intro" style="--d: 520ms">
            <div
              v-for="(indicator, i) in stepIndicators"
              :key="indicator.key"
              :class="[
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all',
                currentStep >= i
                  ? 'bg-white/90 dark:bg-white/[0.06] border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-none'
                  : 'bg-white/60 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.04]'
              ]"
            >
              <div
                :class="[
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors flex-shrink-0',
                  currentStep > i
                    ? 'bg-emerald-500 text-white'
                    : currentStep === i
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-zinc-600'
                ]"
              >
                <Icon v-if="currentStep > i" name="heroicons:check" class="w-3.5 h-3.5" />
                <span v-else>{{ i + 1 }}</span>
              </div>
              <div>
                <div :class="['text-sm font-medium', currentStep >= i ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-600']">
                  {{ indicator.label }}
                </div>
                <p v-if="currentStep === i" class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{{ indicator.hint }}</p>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 shadow-sm dark:shadow-none intro hide-short" style="--d: 620ms">
            Your data stays on your server. No telemetry, no external calls.
          </div>
        </aside>

        <!-- Form Card -->
        <section class="relative lg:self-center">
          <div class="setup-card intro" style="--d: 220ms">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">
              <span>Step {{ currentStep + 1 }} of {{ totalSteps }}</span>
              <span>{{ stepIndicators[currentStep]?.label }}</span>
            </div>
            <div class="mt-4 mb-8 h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 transition-all duration-500" :style="{ width: progressWidth }" />
            </div>

            <!-- Error Message -->
            <div
              v-if="error"
              class="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-sm flex items-start gap-3"
            >
              <Icon name="heroicons:exclamation-circle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{{ error }}</span>
            </div>

            <!-- Step Content -->
            <Transition name="step" mode="out-in">
              <!-- Step: Mode Selection -->
              <div v-if="currentStepKey === 'mode'" key="mode" class="space-y-6">
                <div class="text-center">
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">How will you use ClawLab?</h2>
                  <p class="text-slate-500 dark:text-zinc-400 text-sm">Choose your setup path. You can invite teammates later either way.</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <button
                    @click="selectMode('personal')"
                    :class="[
                      'flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all cursor-pointer',
                      mode === 'personal'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-md'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:shadow-md'
                    ]"
                  >
                    <div class="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-white/[0.08] dark:to-white/[0.04] rounded-xl flex items-center justify-center mb-3">
                      <Icon name="heroicons:user" class="w-6 h-6 text-slate-600 dark:text-zinc-300" />
                    </div>
                    <h3 class="text-base font-semibold text-slate-900 dark:text-zinc-100">Just me</h3>
                    <p class="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">Personal workspace. Quick setup, done in 30 seconds.</p>
                  </button>

                  <button
                    @click="selectMode('team')"
                    :class="[
                      'flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all cursor-pointer',
                      mode === 'team'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-md'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:shadow-md'
                    ]"
                  >
                    <div class="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-white/[0.08] dark:to-white/[0.04] rounded-xl flex items-center justify-center mb-3">
                      <Icon name="heroicons:user-group" class="w-6 h-6 text-slate-600 dark:text-zinc-300" />
                    </div>
                    <h3 class="text-base font-semibold text-slate-900 dark:text-zinc-100">Team</h3>
                    <p class="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">Organization, workspace, invite teammates.</p>
                  </button>
                </div>
              </div>

              <!-- Step: Organization (team only) -->
              <div v-else-if="currentStepKey === 'organization'" key="organization" class="space-y-6">
                <div class="text-center">
                  <div :class="['w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mx-auto mb-4', iconGradients.violet]">
                    <Icon name="heroicons:building-office-2" :class="['w-6 h-6', iconColors.violet]" />
                  </div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Create your organization</h2>
                  <p class="text-slate-500 dark:text-zinc-400 text-sm">This is your team or company name.</p>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Organization name</label>
                    <input
                      v-model="orgName"
                      type="text"
                      placeholder="Acme Inc."
                      class="setup-input"
                      @keyup.enter="nextStep"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">URL slug</label>
                    <div class="flex items-center">
                      <span class="px-3 py-3 bg-slate-50 dark:bg-white/[0.04] border border-r-0 border-slate-200 dark:border-white/[0.1] rounded-l-xl text-slate-400 dark:text-zinc-500 text-sm">localhost/</span>
                      <input
                        v-model="orgSlug"
                        type="text"
                        placeholder="acme"
                        class="flex-1 px-4 py-3 border border-slate-200 dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-zinc-100 rounded-r-xl focus:outline-none focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/[0.05] focus:border-slate-400 dark:focus:border-white/[0.2] transition-all"
                        @keyup.enter="nextStep"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step: Workspace -->
              <div v-else-if="currentStepKey === 'workspace'" key="workspace" class="space-y-6">
                <div class="text-center">
                  <div :class="['w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mx-auto mb-4', iconGradients.emerald]">
                    <Icon name="heroicons:folder" :class="['w-6 h-6', iconColors.emerald]" />
                  </div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Create your first workspace</h2>
                  <p class="text-slate-500 dark:text-zinc-400 text-sm">Workspaces help you organize different projects or teams.</p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Workspace name</label>
                  <input
                    v-model="workspaceName"
                    type="text"
                    placeholder="Product Development"
                    class="setup-input"
                    @keyup.enter="nextStep"
                  />
                </div>
              </div>

              <!-- Step: Profile -->
              <div v-else-if="currentStepKey === 'profile'" key="profile" class="space-y-6">
                <div class="text-center">
                  <div :class="['w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mx-auto mb-4', iconGradients.amber]">
                    <Icon name="heroicons:user" :class="['w-6 h-6', iconColors.amber]" />
                  </div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Your profile</h2>
                  <p class="text-slate-500 dark:text-zinc-400 text-sm">Set up your admin account.</p>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Your name</label>
                    <input
                      v-model="userName"
                      type="text"
                      placeholder="Jane Smith"
                      class="setup-input"
                      @keyup.enter="nextStep"
                    />
                  </div>
                  <div v-if="mode === 'team'">
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Email address</label>
                    <input
                      v-model="userEmail"
                      type="email"
                      placeholder="jane@example.com"
                      class="setup-input"
                      @keyup.enter="nextStep"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Password</label>
                    <input
                      v-model="userPassword"
                      type="password"
                      placeholder="At least 8 characters"
                      class="setup-input"
                      @keyup.enter="nextStep"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Confirm password</label>
                    <input
                      v-model="userPasswordConfirm"
                      type="password"
                      placeholder="Confirm your password"
                      class="setup-input"
                      @keyup.enter="nextStep"
                    />
                    <p v-if="userPassword.length >= 8 && userPasswordConfirm.length > 0 && userPassword !== userPasswordConfirm" class="text-xs text-rose-500 dark:text-rose-400 mt-1.5">
                      Passwords do not match
                    </p>
                  </div>
                </div>
              </div>

              <!-- Step: Invite (team only) -->
              <div v-else-if="currentStepKey === 'invite'" key="invite" class="space-y-6">
                <div class="text-center">
                  <div :class="['w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mx-auto mb-4', iconGradients.blue]">
                    <Icon name="heroicons:user-plus" :class="['w-6 h-6', iconColors.blue]" />
                  </div>
                  <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Invite your team</h2>
                  <p class="text-slate-500 dark:text-zinc-400 text-sm">Add teammates to collaborate with. You can skip this for now.</p>
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300">Team member emails</label>
                    <span class="text-xs text-slate-400 dark:text-zinc-500">Up to {{ maxInvites }} invites</span>
                  </div>

                  <div v-for="(email, index) in teamEmails" :key="index" class="flex items-center gap-2">
                    <input
                      v-model="teamEmails[index]"
                      type="email"
                      placeholder="teammate@company.com"
                      class="flex-1 setup-input"
                      @keyup.enter="index === teamEmails.length - 1 ? addEmailField() : null"
                    />
                    <button
                      v-if="teamEmails.length > 1"
                      @click="removeEmailField(index)"
                      class="p-2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                      <Icon name="heroicons:x-mark" class="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    v-if="teamEmails.length < maxInvites"
                    @click="addEmailField"
                    class="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    <Icon name="heroicons:plus" class="w-4 h-4" />
                    <span>Add another</span>
                  </button>

                  <p v-if="validTeamEmails.length > 0" class="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                    {{ validTeamEmails.length }} teammate{{ validTeamEmails.length > 1 ? 's' : '' }} will be invited
                  </p>
                </div>

                <!-- Demo Data Checkbox -->
                <div class="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                  <label class="flex items-start gap-3 cursor-pointer group">
                    <div class="relative mt-0.5">
                      <input v-model="loadDemoData" type="checkbox" class="sr-only peer" />
                      <div class="w-5 h-5 border-2 border-slate-200 dark:border-white/[0.15] rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover:border-slate-300 dark:group-hover:border-white/[0.25]" />
                      <Icon name="heroicons:check" class="absolute inset-0 m-auto w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <span class="text-sm font-medium text-slate-700 dark:text-zinc-300">Load demo data</span>
                      <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Start with sample projects, tasks, and team members.</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Step: Agents -->
              <div v-else-if="currentStepKey === 'agents'" key="agents" class="space-y-6">
                <template v-if="generatedAgentKeys.length === 0">
                  <div class="text-center">
                    <div :class="['w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mx-auto mb-4', iconGradients.cyan]">
                      <Icon name="heroicons:cpu-chip" :class="['w-6 h-6', iconColors.cyan]" />
                    </div>
                    <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Add Agent Teammates</h2>
                    <p class="text-slate-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
                      Agents can take assigned tasks, break work into subtasks, and post updates. This step is optional.
                    </p>
                  </div>

                  <div class="space-y-4">
                    <div class="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] space-y-3">
                      <div class="grid sm:grid-cols-[1fr,170px,auto] gap-3 items-end">
                        <div>
                          <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Agent name</label>
                          <input
                            v-model="agentName"
                            type="text"
                            maxlength="80"
                            placeholder="Release Assistant"
                            class="setup-input"
                            @keyup.enter="addAgent"
                          />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">Provider</label>
                          <select v-model="agentProvider" class="setup-input">
                            <option v-for="provider in agentProviders" :key="provider.value" :value="provider.value">{{ provider.label }}</option>
                          </select>
                        </div>
                        <button
                          @click="addAgent"
                          class="h-11 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                        >
                          Add Agent
                        </button>
                      </div>
                      <p v-if="agentFormError" class="text-xs text-rose-500 dark:text-rose-400">{{ agentFormError }}</p>
                      <p v-else class="text-xs text-slate-400 dark:text-zinc-500">Skip this now if you want and add agents later in Workspace Settings.</p>
                    </div>

                    <div v-if="agents.length" class="space-y-2">
                      <div
                        v-for="agent in agents"
                        :key="agent.id"
                        class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03]"
                      >
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">{{ agent.name }}</p>
                          <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {{ agentProviders.find(p => p.value === agent.provider)?.label || 'Custom' }}
                          </p>
                        </div>
                        <button
                          @click="removeAgent(agent.id)"
                          class="px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Demo data checkbox (personal mode only, since team mode has it in invite step) -->
                  <div v-if="mode === 'personal'" class="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                    <label class="flex items-start gap-3 cursor-pointer group">
                      <div class="relative mt-0.5">
                        <input v-model="loadDemoData" type="checkbox" class="sr-only peer" />
                        <div class="w-5 h-5 border-2 border-slate-200 dark:border-white/[0.15] rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all group-hover:border-slate-300 dark:group-hover:border-white/[0.25]" />
                        <Icon name="heroicons:check" class="absolute inset-0 m-auto w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <span class="text-sm font-medium text-slate-700 dark:text-zinc-300">Load demo data</span>
                        <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Start with sample projects and tasks to explore.</p>
                      </div>
                    </label>
                  </div>
                </template>

                <template v-else>
                  <div class="text-center">
                    <div :class="['w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mx-auto mb-4', iconGradients.cyan]">
                      <Icon name="heroicons:key" :class="['w-6 h-6', iconColors.cyan]" />
                    </div>
                    <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Save agent API keys</h2>
                    <p class="text-slate-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
                      These keys are shown once. Copy and store them securely before entering your workspace.
                    </p>
                  </div>

                  <div class="space-y-3">
                    <div
                      v-for="agent in generatedAgentKeys"
                      :key="agent.id"
                      class="p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] space-y-3"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div>
                          <p class="text-sm font-medium text-slate-900 dark:text-zinc-100">{{ agent.name }}</p>
                          <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {{ agentProviders.find(p => p.value === agent.provider)?.label || 'Custom' }}
                          </p>
                        </div>
                        <button
                          @click="copyAgentKey(agent.id, agent.apiKey)"
                          class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          {{ copiedAgentKeyId === agent.id ? 'Copied!' : 'Copy key' }}
                        </button>
                      </div>
                      <div class="p-3 rounded-lg border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
                        <code class="text-xs break-all text-slate-700 dark:text-zinc-300">{{ agent.apiKey }}</code>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </Transition>

            <!-- Navigation Buttons -->
            <div class="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                v-if="currentStep > 0 && generatedAgentKeys.length === 0"
                @click="prevStep"
                class="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
              >
                <Icon name="heroicons:arrow-left" class="w-4 h-4" />
                <span>Back</span>
              </button>
              <div v-else />

              <button
                v-if="currentStepKey !== 'agents' && currentStepKey !== 'mode'"
                @click="nextStep"
                :disabled="!canProceed"
                :class="[
                  'flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                  canProceed
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                ]"
              >
                <span>Continue</span>
                <Icon name="heroicons:arrow-right" class="w-4 h-4" />
              </button>

              <button
                v-else-if="currentStepKey === 'agents'"
                @click="generatedAgentKeys.length ? finishSetup() : completeSetup()"
                :disabled="isSubmitting"
                :class="[
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                  !isSubmitting
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                ]"
              >
                <Icon v-if="isSubmitting" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                <span>{{ isSubmitting ? 'Creating...' : (generatedAgentKeys.length ? 'Enter Workspace' : 'Complete Setup') }}</span>
                <Icon v-if="!isSubmitting && generatedAgentKeys.length === 0" name="heroicons:check" class="w-4 h-4" />
                <Icon v-if="!isSubmitting && generatedAgentKeys.length > 0" name="heroicons:arrow-right" class="w-4 h-4" />
              </button>

              <div v-else />
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Background ──────────────────────────────────── */

.setup-bg {
  background-image:
    radial-gradient(60% 60% at 15% 10%, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0)),
    linear-gradient(120deg, rgba(16, 185, 129, 0.14) 0%, rgba(255, 255, 255, 0.96) 45%),
    linear-gradient(300deg, rgba(56, 189, 248, 0.12) 0%, rgba(255, 255, 255, 0.96) 55%),
    linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
}

@media (prefers-color-scheme: dark) {
  .setup-bg {
    background-image: none;
    background: linear-gradient(180deg, #050506 0%, #0f0f18 100%);
  }
}

/* ── Card ─────────────────────────────────────────── */

.setup-card {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.12), 0 10px 30px rgba(15, 23, 42, 0.06);
  padding: 32px;
  backdrop-filter: blur(10px);
}

@media (prefers-color-scheme: dark) {
  .setup-card {
    border-color: rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.2);
  }
}

/* ── Input ────────────────────────────────────────── */

.setup-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(226 232 240); /* border-slate-200 */
  background: white;
  outline: none;
  transition: all 0.15s;
}

.setup-input:focus {
  box-shadow: 0 0 0 4px rgb(241 245 249); /* ring-slate-100 */
  border-color: rgb(148 163 184); /* border-slate-400 */
}

@media (prefers-color-scheme: dark) {
  .setup-input {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: rgb(244 244 245); /* zinc-100 */
  }

  .setup-input:focus {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }
}

/* ── Step transitions ─────────────────────────────── */

.step-enter-active,
.step-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.step-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.step-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ── Intro animation ──────────────────────────────── */

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

/* ── Word animate ─────────────────────────────────── */

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
  background-image: linear-gradient(120deg, #64748b, #94a3b8, #34d399);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

@media (prefers-color-scheme: dark) {
  .word-animate--accent {
    background-image: linear-gradient(120deg, #94a3b8, #e2e8f0, #4ade80);
  }
}

.is-ready .word-animate {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

/* ── Responsive ───────────────────────────────────── */

@media (max-width: 640px) {
  .setup-card {
    padding: 26px;
  }
}

@media (min-width: 1280px) {
  .setup-card {
    padding: 36px;
  }
}

@media (max-height: 750px) {
  .hide-short {
    display: none;
  }
}
</style>
