<script setup lang="ts">
definePageMeta({ layout: false })

const previewItems = [
  { name: 'Launch Platform v2.0', depth: 0, progress: 76, status: 'On track', dotColor: 'bg-emerald-400', barColor: 'bg-emerald-400', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700' },
  { name: 'Billing & Payments', depth: 1, progress: 45, status: 'At risk', dotColor: 'bg-amber-400', barColor: 'bg-amber-400', pillBg: 'bg-amber-50', pillText: 'text-amber-700' },
  { name: 'API Integration', depth: 2, progress: 20, status: 'Blocked', dotColor: 'bg-rose-400', barColor: 'bg-rose-400', pillBg: 'bg-rose-50', pillText: 'text-rose-700' },
  { name: 'Payment Forms', depth: 2, progress: 82, status: 'On track', dotColor: 'bg-emerald-400', barColor: 'bg-emerald-400', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700' },
  { name: 'User Onboarding', depth: 1, progress: 91, status: 'On track', dotColor: 'bg-emerald-400', barColor: 'bg-emerald-400', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700' },
  { name: 'Analytics Dashboard', depth: 1, progress: 58, status: 'Active', dotColor: 'bg-blue-400', barColor: 'bg-blue-400', pillBg: 'bg-blue-50', pillText: 'text-blue-700' },
]

const marqueeItems = [
  { label: 'Product Teams', icon: 'heroicons:cube-transparent' },
  { label: 'Engineering', icon: 'heroicons:command-line' },
  { label: 'Leadership', icon: 'heroicons:chart-bar' },
  { label: 'Stakeholders', icon: 'heroicons:user-group' },
  { label: 'Design', icon: 'heroicons:paint-brush' },
  { label: 'Delivery Leads', icon: 'heroicons:rocket-launch' },
  { label: 'Platform Teams', icon: 'heroicons:server-stack' },
  { label: 'Founders', icon: 'heroicons:light-bulb' },
  { label: 'Operations', icon: 'heroicons:cog-6-tooth' },
  { label: 'QA Teams', icon: 'heroicons:shield-check' },
  { label: 'Agencies', icon: 'heroicons:building-office' },
  { label: 'Consultants', icon: 'heroicons:briefcase' },
]

const pipelineSteps = [
  { icon: 'heroicons:plus-circle', label: 'Create', desc: 'Start with items at any depth. Projects, features, tasks, subtasks, all the same recursive model.', bgClass: 'bg-slate-100', iconClass: 'text-slate-600' },
  { icon: 'heroicons:queue-list', label: 'Structure', desc: 'Nest as deep as you need. Progress rolls up through every level automatically.', bgClass: 'bg-sky-50', iconClass: 'text-sky-600' },
  { icon: 'heroicons:sparkles', label: 'Analyze', desc: 'AI evaluates risk, flags blockers, and tracks progress across every layer of your project.', bgClass: 'bg-violet-50', iconClass: 'text-violet-600' },
  { icon: 'heroicons:chart-bar', label: 'Forecast', desc: 'Get confidence ranges, not single dates. See what\'s slipping before deadlines hit.', bgClass: 'bg-amber-50', iconClass: 'text-amber-600' },
  { icon: 'heroicons:megaphone', label: 'Publish', desc: 'Stakeholder updates generate and publish themselves from real work. Zero manual reporting.', bgClass: 'bg-emerald-50', iconClass: 'text-emerald-600' },
  { icon: 'heroicons:rocket-launch', label: 'Ship', desc: 'Your team ships outcomes. Stakeholders stay calm. Everyone sees exactly what matters to them.', bgClass: 'bg-rose-50', iconClass: 'text-rose-600' },
]

const capabilities = [
  { pain: 'Lost in flat lists and scattered spreadsheets?', title: 'Infinite nesting', desc: 'One model, infinite depth. Projects contain epics contain tasks contain subtasks, and everything rolls up automatically.', visual: 'nesting', features: ['Unlimited hierarchy depth with automatic roll-up', 'Progress, confidence, and status cascade through every level', 'Drag-and-drop restructuring across the tree'] },
  { pain: 'Deadlines slip silently until it\'s too late?', title: 'Live forecast ranges', desc: 'Confidence intervals tighten or widen in real-time as work progresses. Not a single date, a window of truth.', visual: 'forecast', features: ['AI-generated confidence ranges that update daily', 'Temperature indicators flag items going cold or critical', 'Early warnings surface before deadlines are at risk'] },
  { pain: 'Hours spent writing updates nobody reads?', title: 'Auto stakeholder reports', desc: 'AI curates weekly briefs from actual work. Risks, decisions, progress, all published to stakeholder spaces automatically.', visual: 'report', features: ['Stakeholder portals with curated, role-based views', 'AI drafts updates from actual activity, not manual input', 'Published on schedule with zero effort from your team'] },
  { pain: 'No idea what\'s actually blocking what?', title: 'Dependency tracking', desc: 'See your critical path instantly. One blocked subtask surfaces risk across every item it touches.', visual: 'dependency', features: ['Visual dependency graph across the full hierarchy', 'Blocked items propagate risk up to parent projects', 'Critical path detection highlights what to unblock first'] },
  { pain: 'ClawLab buried in Slack threads and email?', title: 'AI team channels', desc: 'Built-in channels tied to your projects. AI summarizes discussions, detects blockers, and connects decisions to the work.', visual: 'channels', features: ['Project-linked channels keep context next to the work', 'AI summarizes threads and extracts action items', 'Decisions and blockers auto-tagged to relevant items'] },
  { pain: 'Where does your team\'s week actually go?', title: 'Focus time tracking', desc: 'Track deep work, meetings, admin, and learning. See who\'s in flow and who\'s drowning in syncs.', visual: 'focus', features: ['Five focus lanes: deep work, meetings, admin, learning, break', 'Team-wide heatmaps show where time is really going', 'Spot burnout patterns and protect maker schedules'] },
]

const stats = [
  { target: 72, prefix: '', suffix: '%', label: 'Status updates automated', accent: 'from-slate-700 to-emerald-400' },
  { target: 31, prefix: '+', suffix: '%', label: 'Forecast confidence gain', accent: 'from-slate-700 to-sky-400' },
  { target: 6, prefix: '-', suffix: ' hrs', label: 'Meeting time saved weekly', accent: 'from-slate-700 to-amber-400' },
]

// Count-up animation for stats
const statsRef = ref<HTMLElement | null>(null)
const statsCounted = ref(false)
const statValues = reactive([0, 0, 0])

const animateCountUp = () => {
  if (statsCounted.value) return
  statsCounted.value = true

  const duration = 1600
  const startTime = performance.now()

  const tick = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)

    stats.forEach((stat, i) => {
      statValues[i] = Math.round(eased * stat.target)
    })

    if (progress < 1) requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
}

onMounted(() => {
  if (!statsRef.value) return
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        animateCountUp()
        observer.disconnect()
      }
    },
    { threshold: 0.3 }
  )
  observer.observe(statsRef.value)
})

const plans = [
  {
    name: 'Free',
    price: '$0',
    priceNote: 'forever',
    featured: false,
    cta: 'Get started free',
    features: [
      { label: 'Internal seats', value: '5' },
      { label: 'External seats', value: '3' },
      { label: 'Projects', value: '1' },
      { label: 'External spaces', value: '1' },
      { label: 'AI credits / user / mo', value: '100' },
    ],
  },
  {
    name: 'Pro',
    price: 'From $5',
    priceNote: 'per seat / mo',
    featured: true,
    cta: 'Get started',
    features: [
      { label: 'Internal seats', value: 'Up to 100' },
      { label: 'External seats', value: 'Up to 100' },
      { label: 'Projects', value: '25' },
      { label: 'External spaces', value: '25' },
      { label: 'AI credits / user / mo', value: '10,000' },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceNote: 'tailored to your org',
    featured: false,
    cta: 'Contact sales',
    features: [
      { label: 'Internal seats', value: 'Unlimited' },
      { label: 'External seats', value: 'Unlimited' },
      { label: '100+ seats per type', value: '' },
      { label: 'Projects', value: 'Unlimited' },
      { label: 'External spaces', value: 'Unlimited' },
      { label: 'AI credits / user / mo', value: 'Custom' },
    ],
  },
]

// Mini pricing calculator for landing page
const { calculateSeatCost, SEAT_TIERS } = usePricing()
const calcInternal = ref(10)
const calcExternal = ref(5)
const calcTotal = computed(() =>
  calculateSeatCost(calcInternal.value, 'INTERNAL') + (calcExternal.value > 0 ? calculateSeatCost(calcExternal.value, 'EXTERNAL') : 0)
)
const calcFullPrice = computed(() =>
  calcInternal.value * SEAT_TIERS.INTERNAL.prices[0]! + calcExternal.value * SEAT_TIERS.EXTERNAL.prices[0]!
)
const calcSavingPct = computed(() => {
  if (calcFullPrice.value <= 0 || calcTotal.value >= calcFullPrice.value) return 0
  return ((calcFullPrice.value - calcTotal.value) / calcFullPrice.value) * 100
})

const proOnboardingUrl = computed(() => {
  const params = new URLSearchParams({ plan: 'pro' })
  if (calcInternal.value !== 10) params.set('seats', String(calcInternal.value))
  if (calcExternal.value !== 5) params.set('ext', String(calcExternal.value))
  return `/onboarding?${params.toString()}`
})

const navItems = [
  { id: 'pipeline', label: 'How it works' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'proof', label: 'Results' },
  { id: 'pricing', label: 'Pricing' },
]

const sectionRefs = reactive<Record<string, HTMLElement | null>>({
  hero: null,
  pipeline: null,

  capabilities: null,
  proof: null,
  pricing: null,
})

const activeSection = ref('hero')
const ready = ref(false)
const scrolled = ref(false)
const accentLineRef = ref<HTMLElement | null>(null)
const activeCapability = ref(0)

const toggleCapability = (i: number) => {
  activeCapability.value = i
}

const updateAccentGradient = () => {
  const line = accentLineRef.value
  if (!line) return
  const rect = line.getBoundingClientRect()
  if (!rect.width) return
  const words = line.querySelectorAll<HTMLElement>('.word-animate--accent')
  words.forEach((word) => {
    const wordRect = word.getBoundingClientRect()
    const offset = wordRect.left - rect.left
    word.style.setProperty('--accent-width', `${rect.width}px`)
    word.style.setProperty('--accent-x', `${-offset}px`)
  })
}

const scrollToSection = (id: string) => {
  const el = sectionRefs[id]
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 73
  window.scrollTo({ top, behavior: 'smooth' })
}

onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
    updateAccentGradient()
  })

  let resizeRaf = 0
  const handleResize = () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => updateAccentGradient())
  }
  window.addEventListener('resize', handleResize)

  const onScroll = () => { scrolled.value = window.scrollY > 20 }
  window.addEventListener('scroll', onScroll, { passive: true })

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) activeSection.value = visible[0].target.id
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('is-visible')
      })
    },
    { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
  )

  nextTick(() => {
    Object.values(sectionRefs).forEach((el) => {
      if (el) observer.observe(el)
    })
  })

  onUnmounted(() => {
    observer.disconnect()
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', handleResize)
  })
})
</script>

<template>
  <div class="clawlab-landing min-h-screen bg-white text-slate-900 scroll-smooth" :class="{ 'is-ready': ready }">
    <!-- Nav -->
    <nav
      data-landing-nav
      class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl nav-intro border-b shadow-sm transition-all duration-300"
      :class="scrolled ? 'bg-white/80 border-slate-200/60 shadow-slate-200/50' : 'bg-transparent border-transparent shadow-transparent'"
    >
      <div class="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <div class="flex items-center gap-8">
          <button @click="scrollToSection('hero')" class="flex items-center gap-2.5 cursor-pointer">
            <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="text-lg font-semibold tracking-tight">ClawLab</span>
          </button>
          <div class="hidden md:flex items-center gap-6 text-sm text-slate-500">
            <button
              v-for="item in navItems"
              :key="item.id"
              class="transition-colors duration-200"
              :class="activeSection === item.id ? 'text-slate-900 font-medium' : 'hover:text-slate-900'"
              @click="scrollToSection(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/login" class="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Sign in
          </NuxtLink>
          <NuxtLink
            to="/onboarding"
            class="hidden sm:inline-flex px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Get started free
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section
      id="hero"
      :ref="(el) => (sectionRefs.hero = el as HTMLElement | null)"
      class="hero-section relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden scroll-mt-20"
    >
      <div class="hero-glow" aria-hidden="true" />

      <div class="relative max-w-4xl mx-auto text-center">
        <h1 class="text-4xl font-semibold sm:text-5xl sm:font-medium md:text-6xl lg:text-7xl tracking-tight leading-[1.1]">
          <span class="word-animate" style="--d: 55ms">Ship</span>
          <span class="word-animate" style="--d: 110ms">outcomes,</span>
          <br />
          <span ref="accentLineRef">
            <span class="word-animate word-animate--accent" style="--d: 175ms">not</span>
            <span class="word-animate word-animate--accent" style="--d: 230ms">status</span>
            <span class="word-animate word-animate--accent" style="--d: 280ms">reports.</span>
          </span>
        </h1>

        <p class="mt-6 text-base md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed intro" style="--d: 370ms">
          One recursive model from portfolio to subtask. AI-driven forecasts surface risk early. Stakeholder updates write themselves.
        </p>

        <div class="mt-8 flex items-center justify-center gap-4 intro" style="--d: 430ms">
          <NuxtLink
            to="/onboarding"
            class="inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            Get started free
            <Icon name="heroicons:arrow-right" class="w-4 h-4" />
          </NuxtLink>
          <button
            type="button"
            class="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            @click="scrollToSection('pipeline')"
          >
            See how it works
          </button>
        </div>

      </div>

      <!-- Hero Visualization: Project + AI Update (hidden on mobile) -->
      <div class="hidden md:block mt-16 w-full max-w-6xl mx-auto px-2">
        <div class="grid md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          <!-- Project View -->
          <div class="intro flex flex-col" style="--d: 500ms">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 text-center md:text-left">Your project</div>
            <div class="showcase-card flex flex-col flex-1">
              <div class="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
                <div>
                  <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Project</div>
                  <div class="text-base font-semibold text-slate-900 mt-0.5">Launch Platform v2.0</div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <svg viewBox="0 0 36 36" class="w-11 h-11">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="2.5" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="76 100" stroke-linecap="round" transform="rotate(-90 18 18)" />
                    </svg>
                    <span class="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-700">76%</span>
                  </div>
                  <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">On track</span>
                </div>
              </div>

              <div class="p-3">
                <div
                  v-for="item in previewItems.slice(1)"
                  :key="item.name"
                  class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50/80 transition-colors"
                  :style="{ paddingLeft: `${(item.depth - 1) * 20 + 14}px` }"
                >
                  <div class="flex items-center gap-2.5 flex-1 min-w-0">
                    <span class="w-2 h-2 rounded-full flex-shrink-0" :class="item.dotColor" />
                    <span class="text-sm text-slate-700 truncate">{{ item.name }}</span>
                  </div>
                  <div class="flex items-center gap-2.5">
                    <div class="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                      <div class="h-full rounded-full" :class="item.barColor" :style="{ width: item.progress + '%' }" />
                    </div>
                    <span class="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" :class="[item.pillBg, item.pillText]">{{ item.status }}</span>
                  </div>
                </div>
              </div>

              <div class="px-5 pb-5 pt-3 border-t border-slate-50 mt-auto">
                <div class="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                  <span class="font-semibold text-slate-500">Forecast range</span>
                  <span>Feb 14–16</span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 relative overflow-hidden">
                  <div class="absolute inset-y-0 left-[28%] w-[44%] rounded-full bg-gradient-to-r from-emerald-300 to-teal-400" />
                  <div class="absolute left-[50%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow ring-1 ring-slate-300" />
                </div>
              </div>
            </div>
          </div>

          <!-- AI Stakeholder Update -->
          <div class="intro flex flex-col" style="--d: 580ms">
            <div class="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-3 flex items-center justify-center md:justify-start gap-1.5">
              <Icon name="heroicons:sparkles" class="w-3.5 h-3.5" />
              Auto-generated update
            </div>
            <div class="showcase-card showcase-card--ai flex-1">
              <div class="p-6">
                <div class="text-base font-semibold text-slate-900">Weekly Stakeholder Brief</div>
                <div class="text-xs text-slate-400 mt-0.5">Launch Platform v2.0 · Feb 7, 2026</div>

                <div class="mt-5 text-sm text-slate-600 leading-relaxed">
                  Overall progress at 76%, on track for the Feb 14–16 delivery window. One risk item requires attention.
                </div>

                <div class="mt-5">
                  <div class="text-[11px] font-semibold text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Risks
                  </div>
                  <div class="mt-2.5 text-sm text-slate-600 leading-relaxed pl-3 border-l-2 border-amber-200">
                    Billing module at 45%. API integration blocked on partner approval. Estimated 2-3 day impact on timeline.
                  </div>
                </div>

                <div class="mt-5">
                  <div class="text-[11px] font-semibold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Wins
                  </div>
                  <div class="mt-2.5 space-y-2 text-sm text-slate-600 leading-relaxed pl-3 border-l-2 border-emerald-200">
                    <div>User Onboarding near completion at 91%.</div>
                    <div>Payment Forms ahead of schedule at 82%.</div>
                  </div>
                </div>

                <div class="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">Published</span>
                  <span>3 minutes ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Marquee -->
    <div class="marquee-section relative py-6 border-y border-slate-100 bg-white overflow-hidden">
      <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest text-center mb-4">Built for</div>
      <div class="marquee-fade-left" />
      <div class="marquee-fade-right" />
      <div class="marquee-track">
        <template v-for="copy in 4" :key="'copy-' + copy">
          <template v-for="item in marqueeItems" :key="item.label + '-' + copy">
            <span class="marquee-dot" />
            <span class="marquee-label">
              <Icon :name="item.icon" class="w-3.5 h-3.5 text-slate-400" />
              {{ item.label }}
            </span>
          </template>
        </template>
      </div>
    </div>

    <!-- Pipeline -->
    <section
      id="pipeline"
      :ref="(el) => (sectionRefs.pipeline = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-32 bg-slate-50/70 scroll-mt-20 section-reveal"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center scroll-reveal" style="--d: 0ms">
          <div class="text-xs font-semibold text-emerald-600 uppercase tracking-widest">How it works</div>
          <h2 class="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">From items to outcomes</h2>
          <p class="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Six steps from creating your first item to shipping with stakeholder calm.
          </p>
        </div>

        <div class="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          <div
            v-for="(step, i) in pipelineSteps"
            :key="step.label"
            class="process-card scroll-reveal"
            :style="{ '--d': `${100 + i * 70}ms` }"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2.5">
                <span class="process-number">{{ String(i + 1).padStart(2, '0') }}</span>
                <h3 class="text-lg lg:text-xl font-semibold text-slate-900">{{ step.label }}</h3>
              </div>
              <Icon :name="step.icon" class="w-5 h-5" :class="step.iconClass" />
            </div>
            <p class="text-sm text-slate-500 mt-2 leading-relaxed">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Capabilities -->
    <section
      id="capabilities"
      :ref="(el) => (sectionRefs.capabilities = el as HTMLElement | null)"
      class="capabilities-section px-6 py-24 lg:py-32 scroll-mt-20 section-reveal"
    >
      <div class="max-w-7xl mx-auto">
        <div class="grid lg:grid-cols-[5fr,7fr] gap-12 lg:gap-20 items-start">
          <!-- Sticky intro -->
          <div class="lg:sticky lg:top-28 scroll-reveal" style="--d: 0ms">
            <div class="text-xs font-semibold text-emerald-700 uppercase tracking-widest">Capabilities</div>
            <h2 class="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">Powered by intelligence</h2>
            <p class="mt-4 text-lg text-slate-500 leading-relaxed">
              Everything your team needs to ship outcomes while keeping stakeholders informed, automatically.
            </p>

            <ul class="mt-8 space-y-4">
              <li class="flex items-start gap-3">
                <Icon name="heroicons:check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span class="text-sm sm:text-base text-slate-600 leading-relaxed"><span class="font-semibold text-slate-900">One recursive model</span> from portfolio down to subtask. No tool-switching, no sync gaps.</span>
              </li>
              <li class="flex items-start gap-3">
                <Icon name="heroicons:check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span class="text-sm sm:text-base text-slate-600 leading-relaxed"><span class="font-semibold text-slate-900">AI runs continuously</span>, evaluating risk, surfacing blockers, and writing updates from real work.</span>
              </li>
              <li class="flex items-start gap-3">
                <Icon name="heroicons:check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span class="text-sm sm:text-base text-slate-600 leading-relaxed"><span class="font-semibold text-slate-900">Stakeholders see what matters</span> with curated views, auto-published reports, and zero manual effort.</span>
              </li>
              <li class="flex items-start gap-3">
                <Icon name="heroicons:check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span class="text-sm sm:text-base text-slate-600 leading-relaxed"><span class="font-semibold text-slate-900">Built-in focus tracking</span> to see where time goes across deep work, meetings, and admin.</span>
              </li>
            </ul>
          </div>

          <!-- Feature list -->
          <div class="space-y-5 lg:space-y-6 lg:pt-4 lg:pb-16">
            <div
              v-for="(cap, i) in capabilities"
              :key="cap.title"
              class="capability-card scroll-reveal cursor-pointer"
              :class="{ 'capability-card--active': activeCapability === i }"
              :style="{ '--d': `${i * 80}ms` }"
              @click="toggleCapability(i)"
            >
              <!-- Collapsed header (always visible) -->
              <div class="capability-header">
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-slate-400">{{ cap.pain }}</div>
                  <h3 class="text-[15px] font-semibold text-slate-900 mt-0.5">{{ cap.title }}</h3>
                </div>
                <Icon
                  name="heroicons:chevron-down"
                  class="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  :class="{ 'rotate-180': activeCapability === i }"
                />
              </div>

              <!-- Expandable content -->
              <div
                class="capability-expand"
                :class="activeCapability === i ? 'capability-expand--open' : 'capability-expand--closed'"
              >
                <div class="capability-expand-inner">
                  <!-- Mini visuals -->
                  <div class="capability-visual">
                    <!-- Nesting: indented bars (slate + one emerald accent) -->
                    <div v-if="cap.visual === 'nesting'" class="flex flex-col gap-1.5">
                      <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <div class="h-2 flex-1 rounded bg-slate-200" />
                      </div>
                      <div class="flex items-center gap-2 ml-4">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <div class="h-2 flex-1 rounded bg-emerald-200" />
                      </div>
                      <div class="flex items-center gap-2 ml-8">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <div class="h-2 flex-1 rounded bg-slate-200" />
                      </div>
                      <div class="flex items-center gap-2 ml-12">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <div class="h-2 w-3/4 rounded bg-slate-200" />
                      </div>
                    </div>

                    <!-- Forecast: range bar (slate → emerald gradient, no teal) -->
                    <div v-else-if="cap.visual === 'forecast'" class="space-y-1.5">
                      <div class="h-3 rounded-full bg-slate-100 relative overflow-hidden">
                        <div class="absolute inset-y-0 left-[22%] w-[48%] rounded-full bg-gradient-to-r from-slate-300 to-emerald-400 opacity-80" />
                        <div class="absolute left-[46%] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm ring-2 ring-slate-300" />
                        <div class="absolute left-[68%] top-0 bottom-0 w-px bg-slate-300" />
                      </div>
                      <div class="flex justify-between text-[9px] text-slate-400 px-0.5">
                        <span>Start</span>
                        <span class="text-slate-500 font-semibold">Likely window</span>
                        <span>Deadline</span>
                      </div>
                    </div>

                    <!-- Report: mini document (slate lines, emerald badge) -->
                    <div v-else-if="cap.visual === 'report'" class="rounded-lg border border-slate-100 bg-white p-3 space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="h-1.5 w-24 rounded bg-slate-300" />
                        <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Published</span>
                      </div>
                      <div class="h-1 w-full rounded bg-slate-100" />
                      <div class="h-1 w-5/6 rounded bg-slate-200" />
                      <div class="h-1 w-2/3 rounded bg-slate-100" />
                    </div>

                    <!-- Dependency: nodes (slate + one darker blocked node, no rose/pulse) -->
                    <div v-else-if="cap.visual === 'dependency'" class="flex items-center gap-1">
                      <div class="w-5 h-5 rounded-full bg-slate-300 ring-2 ring-slate-200" />
                      <div class="flex-1 h-px bg-slate-200" />
                      <div class="w-5 h-5 rounded-full bg-slate-300 ring-2 ring-slate-200" />
                      <div class="flex-1 h-px bg-slate-200" />
                      <div class="w-5 h-5 rounded-full bg-slate-500 ring-2 ring-slate-300" />
                      <div class="flex-1 h-px bg-slate-200 border-dashed" />
                      <div class="w-5 h-5 rounded-full bg-slate-200 ring-2 ring-slate-100" />
                    </div>

                    <!-- Channels: chat bubbles (both slate, subtle AI badge) -->
                    <div v-else-if="cap.visual === 'channels'" class="flex flex-col gap-2">
                      <div class="self-start max-w-[75%] px-3 py-1.5 rounded-2xl rounded-bl-sm bg-slate-100 text-[10px] text-slate-600">
                        What's the status on billing integration?
                      </div>
                      <div class="self-end max-w-[80%] px-3 py-1.5 rounded-2xl rounded-br-sm bg-slate-100 text-[10px] text-slate-600 flex items-start gap-1.5">
                        <span class="mt-0.5 w-3 h-3 rounded-full bg-emerald-500 text-[6px] text-white flex items-center justify-center font-bold flex-shrink-0">AI</span>
                        <span>2 blockers active. API integration waiting on partner. ETA at risk by 2–3 days.</span>
                      </div>
                    </div>

                    <!-- Focus: time bars (monochrome slate shading) -->
                    <div v-else-if="cap.visual === 'focus'" class="space-y-1.5">
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] text-slate-400 w-6">Mon</span>
                        <div class="flex-1 h-2.5 rounded-full bg-slate-50 flex overflow-hidden">
                          <div class="h-full bg-slate-200 rounded-l-full" style="width: 55%" />
                          <div class="h-full bg-slate-300" style="width: 25%" />
                          <div class="h-full bg-slate-400 rounded-r-full" style="width: 10%" />
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] text-slate-400 w-6">Tue</span>
                        <div class="flex-1 h-2.5 rounded-full bg-slate-50 flex overflow-hidden">
                          <div class="h-full bg-slate-200 rounded-l-full" style="width: 70%" />
                          <div class="h-full bg-slate-300" style="width: 15%" />
                          <div class="h-full bg-slate-400 rounded-r-full" style="width: 8%" />
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[9px] text-slate-400 w-6">Wed</span>
                        <div class="flex-1 h-2.5 rounded-full bg-slate-50 flex overflow-hidden">
                          <div class="h-full bg-slate-300 rounded-l-full" style="width: 60%" />
                          <div class="h-full bg-slate-200" style="width: 20%" />
                          <div class="h-full bg-slate-400 rounded-r-full" style="width: 12%" />
                        </div>
                      </div>
                      <div class="flex gap-3 mt-1 text-[8px] text-slate-400">
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-200" />Deep work</span>
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-300" />Meetings</span>
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-400" />Admin</span>
                      </div>
                    </div>
                  </div>

                  <p class="text-sm text-slate-500 mt-3 leading-relaxed">{{ cap.desc }}</p>
                  <ul v-if="cap.features" class="mt-4 space-y-2">
                    <li v-for="feat in cap.features" :key="feat" class="flex items-start gap-2 text-[13px] text-slate-500 leading-relaxed">
                      <Icon name="heroicons:check" class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{{ feat }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Proof -->
    <section
      id="proof"
      :ref="(el) => (sectionRefs.proof = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-28 bg-white scroll-mt-20 section-reveal"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center scroll-reveal" style="--d: 0ms">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-widest">Results</div>
          <h2 class="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">Measured calm, not just clean UI</h2>
        </div>

        <div ref="statsRef" class="mt-14 grid md:grid-cols-3 gap-5 scroll-reveal" style="--d: 80ms">
          <div v-for="(stat, i) in stats" :key="stat.label" class="stat-card">
            <div class="stat-value bg-gradient-to-br bg-clip-text" :class="stat.accent">{{ stat.prefix }}{{ statValues[i] }}{{ stat.suffix }}</div>
            <p class="mt-2 text-sm text-slate-500">{{ stat.label }}</p>
          </div>
        </div>

        <div class="mt-8 max-w-4xl mx-auto grid md:grid-cols-2 gap-5 scroll-reveal" style="--d: 160ms">
          <div class="quote-card flex flex-col">
            <p class="text-base text-slate-700 leading-relaxed italic flex-1">
              "Our weekly stakeholder sync went from status theater to decision-making. The auto-generated reports are accurate enough that we just review and publish. More time shipping, less time reporting."
            </p>
            <div class="mt-4 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">S</div>
              <div>
                <div class="text-sm font-medium text-slate-800">Sarah, VP of Product</div>
                <div class="text-xs text-slate-400">B2B SaaS, 40-person team</div>
              </div>
            </div>
          </div>
          <div class="quote-card flex flex-col">
            <p class="text-base text-slate-700 leading-relaxed italic flex-1">
              "Stakeholder updates write themselves now, and the recursive task model fits how we actually think about projects. The AI features alone save each engineer on the team 1 to 3 hours a week."
            </p>
            <div class="mt-4 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">T</div>
              <div>
                <div class="text-sm font-medium text-slate-800">Toby, Lead Software Architect</div>
                <div class="text-xs text-slate-400">Engineering team of 10</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section
      id="pricing"
      :ref="(el) => (sectionRefs.pricing = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-32 bg-slate-50/70 scroll-mt-20 section-reveal"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center scroll-reveal" style="--d: 0ms">
          <div class="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Pricing</div>
          <h2 class="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">Simple, transparent pricing</h2>
          <p class="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Start free. Scale when you're ready. Volume discounts built in.
          </p>
        </div>

        <div class="mt-16 grid md:grid-cols-3 gap-5 lg:gap-6 items-start">
          <div
            v-for="(plan, i) in plans"
            :key="plan.name"
            class="pricing-card scroll-reveal"
            :class="{ 'pricing-card--featured': plan.featured }"
            :style="{ '--d': `${100 + i * 70}ms` }"
          >
            <div class="relative">
              <span v-if="plan.featured" class="pricing-badge">Popular</span>
              <div class="text-sm font-semibold text-slate-500 uppercase tracking-widest">{{ plan.name }}</div>
              <div class="mt-3 flex items-baseline gap-1.5">
                <span class="text-4xl font-bold tracking-tight text-slate-900">{{ plan.price }}</span>
                <span class="text-sm text-slate-400">{{ plan.priceNote }}</span>
              </div>
            </div>

            <ul class="mt-8 space-y-3.5">
              <li v-for="feature in plan.features" :key="feature.label" class="flex items-center gap-3">
                <Icon name="heroicons:check" class="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
                <span class="text-sm text-slate-500">
                  <template v-if="feature.value">{{ feature.label }}: <span class="font-semibold text-slate-900">{{ feature.value }}</span></template>
                  <template v-else><span class="font-semibold text-slate-900">{{ feature.label }}</span></template>
                </span>
              </li>
            </ul>

            <!-- Mini pricing calculator (Pro card only) -->
            <div v-if="plan.featured" class="mt-6 p-4 rounded-xl bg-slate-50/80 border border-slate-100">
              <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Estimate your cost</div>
              <div class="space-y-2.5">
                <div class="flex items-center justify-between gap-3">
                  <label class="text-xs text-slate-500 whitespace-nowrap">Internal</label>
                  <input
                    v-model.number="calcInternal"
                    type="number"
                    min="1"
                    max="100"
                    class="w-16 px-2 py-1 border border-slate-200 rounded-md text-xs text-center tabular-nums bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
                <div class="flex items-center justify-between gap-3">
                  <label class="text-xs text-slate-500 whitespace-nowrap">External</label>
                  <input
                    v-model.number="calcExternal"
                    type="number"
                    min="0"
                    max="100"
                    class="w-16 px-2 py-1 border border-slate-200 rounded-md text-xs text-center tabular-nums bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-slate-200">
                <div class="flex items-center justify-between">
                  <span class="text-xs text-slate-500">Monthly total</span>
                  <span class="text-lg font-bold text-slate-900 tabular-nums">${{ calcTotal }}/mo</span>
                </div>
                <div v-if="calcSavingPct > 0" class="flex items-center justify-end gap-1.5 mt-1">
                  <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Save {{ calcSavingPct.toFixed(1) }}%
                  </span>
                  <span class="text-[11px] text-slate-400 line-through tabular-nums">${{ calcFullPrice }}/mo</span>
                </div>
              </div>
            </div>

            <NuxtLink
              :to="plan.name === 'Enterprise' ? '#' : plan.name === 'Pro' ? proOnboardingUrl : '/onboarding'"
              class="mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl transition-all"
              :class="plan.featured
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10'
                : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'"
            >
              {{ plan.cta }}
              <Icon v-if="!plan.featured" name="heroicons:arrow-right" class="w-4 h-4" />
              <Icon v-else name="heroicons:arrow-right" class="w-4 h-4" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-slate-100 py-10 px-6 bg-white">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <span class="text-sm text-slate-400">&copy; 2026 ClawLab Labs</span>
        </div>
        <div class="flex items-center gap-6 text-sm text-slate-400">
          <span>Built by <a href="https://recursion-endeavours.com" target="_blank" rel="noopener" class="hover:text-slate-900 transition-colors underline decoration-slate-300 hover:decoration-slate-900">Recursion Endeavours</a></span>
          <a href="#" class="hover:text-slate-900 transition-colors">Privacy</a>
          <a href="#" class="hover:text-slate-900 transition-colors">Terms</a>
          <a href="#" class="hover:text-slate-900 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────── */

.hero-section {
  background-image:
    radial-gradient(55% 45% at 85% 20%, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0)),
    linear-gradient(120deg, rgba(16, 185, 129, 0.24) 0%, rgba(255, 255, 255, 0.96) 45%),
    linear-gradient(300deg, rgba(56, 189, 248, 0.2) 0%, rgba(255, 255, 255, 0.96) 55%),
    linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
}

.hero-glow {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 700px;
  height: 500px;
  background: radial-gradient(ellipse, rgba(16, 185, 129, 0.08), transparent 70%);
  filter: blur(80px);
  pointer-events: none;
}


/* ── Accent line gradient ─────────────────────────── */

.word-animate--accent {
  background-image: linear-gradient(120deg, #64748b, #94a3b8, #4ade80);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  background-size: var(--accent-width, 100%) 100%;
  background-position: var(--accent-x, 0) 0;
}

/* ── Showcase cards ────────────────────────────────── */

.showcase-card {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: white;
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.03),
    0 20px 50px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.showcase-card--ai {
  border-color: rgba(16, 185, 129, 0.2);
  box-shadow:
    0 1px 3px rgba(16, 185, 129, 0.04),
    0 20px 50px rgba(16, 185, 129, 0.07);
}

/* ── Marquee ──────────────────────────────────────── */

.marquee-track {
  display: flex;
  align-items: center;
  gap: 20px;
  width: max-content;
  animation: marquee 45s linear infinite;
}

.marquee-track:hover {
  animation-play-state: paused;
}

.marquee-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.marquee-dot {
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #cbd5e1;
  flex-shrink: 0;
}

.marquee-fade-left,
.marquee-fade-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120px;
  z-index: 2;
  pointer-events: none;
}

.marquee-fade-left {
  left: 0;
  background: linear-gradient(to right, white, transparent);
}

.marquee-fade-right {
  right: 0;
  background: linear-gradient(to left, white, transparent);
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-25%); }
}

/* ── Process cards ─────────────────────────────────── */

.process-card {
  padding: 28px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: white;
  box-shadow: 0 0 0 transparent;
  transition:
    border-color 300ms ease-in-out,
    box-shadow 300ms ease-in-out;
}

.process-card:hover {
  border-color: rgba(148, 163, 184, 0.3);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.process-number {
  font-size: 1.125rem;   /* matches text-lg (18px) */
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1;
  color: rgba(148, 163, 184, 0.5);
}
@media (min-width: 1024px) {
  .process-number {
    font-size: 1.25rem;  /* matches text-xl (20px) at lg: */
  }
}

/* ── Capabilities section ─────────────────────────── */

.capabilities-section {
  background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdf4 100%);
}

.capability-card {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  transition: border-color 0.3s ease, background 0.3s ease;
}

.capability-card--active {
  border-color: rgba(16, 185, 129, 0.25);
  background: rgba(255, 255, 255, 0.95);
}

.capability-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  min-height: 56px;
}

@media (min-width: 1024px) {
  .capability-header {
    padding: 20px 24px;
    min-height: 64px;
  }
}

.capability-expand {
  overflow: hidden;
  transition:
    max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.capability-expand--open {
  max-height: 500px;
  opacity: 1;
}

.capability-expand--closed {
  max-height: 0;
  opacity: 0;
}

.capability-expand-inner {
  padding: 0 20px 24px;
}

@media (min-width: 1024px) {
  .capability-expand-inner {
    padding: 0 24px 28px;
  }
}

.capability-visual {
  padding-bottom: 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(16, 185, 129, 0.08);
}

/* ── Stats ────────────────────────────────────────── */

.stat-card {
  padding: 24px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(180deg, white, #fafbfc);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
}

.stat-value {
  font-size: clamp(2.2rem, 3vw, 3rem);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.03em;
  -webkit-text-fill-color: transparent;
}

.quote-card {
  padding: 28px 32px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.9), white);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
}

/* ── Pricing cards ────────────────────────────────── */

.pricing-card {
  padding: 32px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: white;
  display: flex;
  flex-direction: column;
  transition:
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.pricing-card--featured {
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 4px 24px rgba(16, 185, 129, 0.1);
}

.pricing-card--featured:hover {
  box-shadow: 0 16px 40px rgba(16, 185, 129, 0.15);
}

.pricing-badge {
  position: absolute;
  top: -2px;
  right: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

/* ── Intro animation ──────────────────────────────── */

.intro {
  opacity: 0;
  transform: translateY(18px);
  filter: blur(8px);
  transition:
    opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform, filter;
}

.is-ready .intro {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

.nav-intro {
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
  will-change: opacity, transform;
}

.is-ready .nav-intro {
  opacity: 1;
  transform: translateY(0);
}

/* ── Word animate ─────────────────────────────────── */

.word-animate {
  display: inline-block;
  margin-right: 0.25em;
  opacity: 0;
  filter: blur(12px);
  transform: translateY(10px);
  transition:
    opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform, filter;
}

.is-ready .word-animate {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

/* ── Scroll reveal ────────────────────────────────── */

.section-reveal .scroll-reveal {
  opacity: 0;
  transform: translateY(20px);
  filter: blur(6px);
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform, filter;
}

.section-reveal.is-visible .scroll-reveal {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

/* ── Responsive ───────────────────────────────────── */

@media (max-width: 640px) {
  .showcase-card {
    border-radius: 14px;
  }

  .quote-card {
    padding: 20px;
  }
}

@media (max-width: 1023px) {
  .capability-card {
    background: rgba(255, 255, 255, 0.85);
  }
  .capability-card--active {
    background: rgba(255, 255, 255, 0.95);
  }
}
</style>
