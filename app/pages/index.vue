<script setup lang="ts">
definePageMeta({
  layout: false,
})

const proofStats = [
  { value: '72%', label: 'status updates automated' },
  { value: '+31%', label: 'forecast confidence in 2 weeks' },
  { value: '-6 hrs/wk', label: 'stakeholder meeting overhead' },
]

const outcomeBlocks = [
  {
    title: 'Stakeholder updates that run themselves',
    body: 'Auto-curated summaries and decisions, straight from the work.',
  },
  {
    title: 'Recursive structure, no rollups',
    body: 'Every subtask rolls up instantly at every level.',
  },
  {
    title: 'Risk that surfaces early',
    body: 'Forecast ranges and blockers appear before dates slip.',
  },
]

const capabilityCards = [
  {
    title: 'Stakeholder spaces, built in',
    body: 'Curated views and requests mapped to the work.',
  },
  {
    title: 'AI teammate for weekly updates',
    body: 'Summaries, risk flags, and draft comms.',
  },
  {
    title: 'Dependency paths with live risk',
    body: 'See what blocks what, instantly.',
  },
  {
    title: 'Public roadmap + upvoted requests',
    body: 'Customer-safe updates with built-in feedback.',
  },
]

const navItems = [
  { id: 'hero', label: 'Overview' },
  { id: 'proof', label: 'Proof' },
  { id: 'recursive', label: 'Recursive' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'capabilities', label: 'Capabilities' },
]

const sectionRefs = reactive<Record<string, HTMLElement | null>>({
  hero: null,
  proof: null,
  outcomes: null,
  recursive: null,
  capabilities: null,
  cta: null,
})

const activeSection = ref('hero')
const heroReady = ref(false)
const accentLineRef = ref<HTMLElement | null>(null)

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
  const target = sectionRefs[id]
  if (!target) return

  const landingRoot = document.querySelector<HTMLElement>('.relai-landing')
  const configuredNavHeight = landingRoot
    ? Number.parseFloat(getComputedStyle(landingRoot).getPropertyValue('--landing-nav-height'))
    : Number.NaN
  const measuredNavHeight = document.querySelector<HTMLElement>('[data-landing-nav]')?.getBoundingClientRect().height ?? 64
  const navHeight = Number.isFinite(configuredNavHeight) ? configuredNavHeight : measuredNavHeight
  const top = target.getBoundingClientRect().top + window.scrollY - navHeight + 1
  window.scrollTo({ top, behavior: 'smooth' })
}

onMounted(() => {
  requestAnimationFrame(() => {
    heroReady.value = true
    updateAccentGradient()
  })

  let resizeRaf = 0
  const handleResize = () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => updateAccentGradient())
  }
  window.addEventListener('resize', handleResize)

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) {
        activeSection.value = visible[0].target.id
      }
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
        }
      })
    },
    {
      root: null,
      rootMargin: '-20% 0px -55% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    }
  )

  Object.values(sectionRefs).forEach((el) => {
    if (el) observer.observe(el)
  })

  onUnmounted(() => {
    observer.disconnect()
    window.removeEventListener('resize', handleResize)
  })
})
</script>

<template>
  <div class="relai-landing min-h-screen bg-white text-slate-900 scroll-smooth" style="--landing-nav-height: 64px" :class="{ 'is-ready': heroReady }">
    <!-- Top nav -->
    <nav data-landing-nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-100 intro" style="--d: 0ms">
      <div class="w-full px-6 h-[var(--landing-nav-height)] flex items-center justify-between">
        <div class="flex items-center gap-8">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span class="text-white text-sm font-semibold">R</span>
            </div>
            <span class="text-lg font-semibold tracking-tight">Relai</span>
          </div>
          <div class="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <button
              v-for="item in navItems"
              :key="item.id"
              class="transition-colors"
              :class="activeSection === item.id ? 'text-slate-900 font-semibold' : 'hover:text-slate-900'"
              @click="scrollToSection(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/login" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Sign in
          </NuxtLink>
          <NuxtLink
            to="/onboarding"
            class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
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
      class="hero-section relative min-h-screen pt-32 pb-20 px-6 xl:pt-36 xl:pb-28 2xl:pt-40 2xl:pb-32 2xl:px-12 overflow-hidden flex items-center scroll-mt-20"
    >

      <div class="max-w-6xl 2xl:max-w-[88rem] mx-auto grid lg:grid-cols-[1.15fr,0.85fr] xl:grid-cols-[1.2fr,0.8fr] 2xl:grid-cols-[1.25fr,0.75fr] gap-10 xl:gap-14 2xl:gap-16 items-center">
        <div>
          <h1 class="mt-2 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-medium leading-tight tracking-tight">
            <span class="word-animate" style="--d: 80ms">Ship</span>
            <span class="word-animate" style="--d: 140ms">outcomes</span>
            <span class="word-animate" style="--d: 200ms">faster,</span>
            <br />
            <span ref="accentLineRef" class="accent-line">
              <span class="word-animate word-animate--accent" style="--d: 260ms">with</span>
              <span class="word-animate word-animate--accent" style="--d: 320ms">stakeholder</span>
              <span class="word-animate word-animate--accent" style="--d: 380ms">calm.</span>
            </span>
          </h1>
          <p class="mt-6 text-lg xl:text-xl text-slate-600 leading-relaxed max-w-xl xl:max-w-2xl intro" style="--d: 520ms">
            One recursive model. Real forecast ranges. Stakeholder spaces that publish the right updates automatically.
          </p>
          <div class="mt-8 flex items-center gap-4 intro" style="--d: 620ms">
            <NuxtLink
              to="/onboarding"
              class="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
            >
              Get started free
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
            </NuxtLink>
            <button
              type="button"
              class="text-sm font-medium text-slate-600 hover:text-slate-900"
              @click="scrollToSection('proof')"
            >
              See outcomes
            </button>
          </div>
          <div class="mt-10 flex flex-wrap items-center gap-3 text-xs intro" style="--d: 720ms">
            <span class="signal-chip">Recursive planning graph</span>
            <span class="signal-chip">Live forecast ranges</span>
            <span class="signal-chip">Auto stakeholder updates</span>
          </div>
        </div>

        <!-- Hero visual -->
        <div class="relative">
          <div class="hero-visual-shell intro" style="--d: 460ms">
            <div class="hero-bubbles">
            <div class="hero-bubble intro border border-slate-200/70" style="--d: 520ms">
              <div class="flex items-center justify-between">
                <div class="text-xs font-semibold text-slate-700">Forecast</div>
                <span class="pill pill--amber">At risk</span>
              </div>
              <div class="mt-2 text-sm font-medium text-slate-800">Est. finish: Feb 6-8</div>
              <div class="mt-3 h-2 rounded-full bg-slate-100 relative overflow-hidden">
                <div class="absolute inset-y-0 left-[35%] w-[40%] rounded-full bg-gradient-to-r from-amber-300 to-orange-400" />
                <div class="absolute left-[55%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow ring-1 ring-slate-400" />
                <div class="absolute left-[72%] -top-1 w-[2px] h-4 bg-slate-600" />
              </div>
            </div>

            <div class="hero-bubble intro border border-slate-200/70" style="--d: 640ms">
              <div class="text-xs font-semibold text-slate-700">Stakeholder update</div>
              <div class="mt-2 text-xs text-slate-600">
                Core API in progress. Two deps resolved. Next: billing.
              </div>
              <div class="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
                <span class="pill pill--emerald">Published</span>
                <span>3m ago</span>
              </div>
            </div>

            <div class="hero-bubble intro border border-slate-200/70" style="--d: 760ms">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">AI</div>
                <div class="text-xs font-semibold text-slate-700">Team chat</div>
              </div>
              <div class="mt-2 text-xs text-slate-600">
                Summarize what changed this week and list blockers.
              </div>
              <div class="mt-2 text-xs text-slate-500">AI: 2 blockers. ETA at risk by 2-3 days.</div>
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
      class="px-6 py-14 xl:py-18 bg-white scroll-mt-20 section-reveal"
    >
      <div class="max-w-6xl 2xl:max-w-7xl mx-auto proof-shell scroll-reveal" style="--d: 10ms">
        <div class="scroll-reveal" style="--d: 0ms">
          <div class="proof-kicker">Proof of value</div>
          <h2 class="mt-3 text-3xl sm:text-4xl xl:text-5xl font-semibold text-slate-900">Measured calm, not just clean UI</h2>
        </div>

        <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-5 scroll-reveal" style="--d: 100ms">
          <article v-for="stat in proofStats" :key="stat.label" class="proof-stat">
            <div class="proof-value">{{ stat.value }}</div>
            <p class="mt-2 text-sm text-slate-600">{{ stat.label }}</p>
          </article>
        </div>

        <div class="mt-6 grid md:grid-cols-[1.3fr,0.7fr] md:items-center gap-4 xl:gap-5 scroll-reveal" style="--d: 160ms">
          <div class="proof-quote">
            <p class="text-sm text-slate-700 leading-relaxed">
              “Our weekly stakeholder sync went from status theater to decision-making. We spend less time reporting and more time shipping.”
            </p>
            <div class="mt-3 text-xs text-slate-500">VP Product, B2B SaaS team</div>
          </div>
          <div class="proof-tags md:self-center">
            <span class="proof-tag">Design partners</span>
            <span class="proof-tag">Product orgs</span>
            <span class="proof-tag">Platform teams</span>
            <span class="proof-tag">Delivery leads</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Recursive -->
    <section
      id="recursive"
      :ref="(el) => (sectionRefs.recursive = el as HTMLElement | null)"
      class="px-6 py-20 xl:py-24 2xl:py-28 bg-white scroll-mt-20 section-reveal"
    >
      <div class="max-w-6xl 2xl:max-w-7xl mx-auto w-full">
        <div class="grid lg:grid-cols-[1.05fr,0.95fr] gap-12 xl:gap-16 w-full items-center">
          <div class="scroll-reveal" style="--d: 0ms">
            <div class="text-xs font-semibold text-sky-600 uppercase tracking-wide">Recursive model</div>
            <h2 class="text-3xl sm:text-4xl xl:text-5xl font-semibold mt-4">One model for every depth</h2>
            <p class="mt-4 text-lg xl:text-xl text-slate-600 max-w-xl xl:max-w-2xl">
              Projects, epics, tasks, subtasks — one model at every depth. Updates roll up instantly, so every level knows
              what is on track, at risk, or blocked.
            </p>
            <div class="mt-8 inline-flex items-center gap-3 text-sm text-slate-600">
              <span class="pill pill--emerald">Rollup by default</span>
              <span class="pill pill--amber">Risk travels upward</span>
            </div>
          </div>
          <div class="recursive-stack scroll-reveal" style="--d: 120ms">
            <div class="recursive-card recursive-card--root">
              <div class="text-xs font-semibold text-slate-700">Project</div>
              <div class="mt-1 text-sm font-medium text-slate-900">Launch platform</div>
              <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>4 epics</span>
                <span class="pill pill--emerald">On track</span>
              </div>
            </div>
            <div class="recursive-card" style="--level: 1">
              <span class="recursive-connector" aria-hidden="true"></span>
              <div class="text-xs font-semibold text-slate-700">Epic</div>
              <div class="mt-1 text-sm font-medium text-slate-900">Billing &amp; payments</div>
              <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>6 tasks</span>
                <span class="pill pill--amber">At risk</span>
              </div>
            </div>
            <div class="recursive-card" style="--level: 2">
              <span class="recursive-connector" aria-hidden="true"></span>
              <div class="text-xs font-semibold text-slate-700">Task</div>
              <div class="mt-1 text-sm font-medium text-slate-900">Core API integration</div>
              <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>3 subtasks</span>
                <span class="pill pill--amber">At risk</span>
              </div>
            </div>
            <div class="recursive-card" style="--level: 3">
              <span class="recursive-connector" aria-hidden="true"></span>
              <div class="text-xs font-semibold text-slate-700">Subtask</div>
              <div class="mt-1 text-sm font-medium text-slate-900">Partner approval</div>
              <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span class="text-rose-600 font-semibold">Blocked</span>
                <span class="pill pill--amber">At risk</span>
              </div>
            </div>
            <div class="recursive-rollup">
              <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rollup</div>
              <div class="mt-2 text-sm text-slate-700">Risk from subtasks lifts into the epic forecast automatically.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Outcomes -->
    <section
      id="outcomes"
      :ref="(el) => (sectionRefs.outcomes = el as HTMLElement | null)"
      class="px-6 py-20 xl:py-24 2xl:py-28 bg-slate-50/60 scroll-mt-20 section-reveal"
    >
      <div class="max-w-6xl 2xl:max-w-7xl mx-auto w-full">
        <div class="grid lg:grid-cols-[1.05fr,0.95fr] gap-12 xl:gap-16 w-full items-center">
          <div class="scroll-reveal" style="--d: 0ms">
            <div class="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Outcomes</div>
            <h2 class="text-3xl sm:text-4xl xl:text-5xl font-semibold mt-4">Stakeholder calm, built in</h2>
            <p class="mt-4 text-lg xl:text-xl text-slate-600 max-w-xl xl:max-w-2xl">
              Fewer status meetings. More shipping. Updates are curated from the work, not a separate doc.
            </p>
            <div class="mt-8 space-y-6">
              <div v-for="block in outcomeBlocks" :key="block.title" class="pl-5 border-l-[3px] border-slate-300">
                <div class="text-sm font-semibold text-slate-900">{{ block.title }}</div>
                <p class="mt-1 text-sm text-slate-600">{{ block.body }}</p>
              </div>
            </div>
          </div>
          <div class="space-y-6 scroll-reveal" style="--d: 120ms">
            <div class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-xl shadow-slate-200/60">
              <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stakeholder space</div>
              <div class="mt-3 text-sm font-semibold text-slate-800">Weekly update</div>
              <div class="mt-2 text-xs text-slate-600">
                Billing integration in progress. Two blockers resolved. Forecast range tightened by 2 days.
              </div>
              <div class="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
                <span class="pill pill--emerald">Published</span>
                <span>Updated today</span>
              </div>
            </div>
            <div class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-xl shadow-slate-200/40">
              <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dependency path</div>
              <div class="mt-3 h-2 rounded-full bg-slate-100 relative overflow-hidden">
                <div class="absolute inset-y-0 left-[20%] w-[55%] rounded-full bg-gradient-to-r from-emerald-300 to-teal-400" />
                <div class="absolute left-[45%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow ring-1 ring-slate-400" />
                <div class="absolute left-[70%] -top-1 w-[2px] h-4 bg-slate-600" />
              </div>
              <div class="mt-3 text-xs text-slate-500">Forecast confidence improving as blockers clear.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Capabilities -->
    <section
      id="capabilities"
      :ref="(el) => (sectionRefs.capabilities = el as HTMLElement | null)"
      class="px-6 py-20 xl:py-24 2xl:py-28 bg-white scroll-mt-20 section-reveal"
    >
      <div class="max-w-6xl 2xl:max-w-7xl mx-auto w-full">
        <div class="grid lg:grid-cols-[0.95fr,1.05fr] gap-12 xl:gap-16 w-full items-center">
          <div class="scroll-reveal" style="--d: 0ms">
            <div class="text-xs font-semibold text-amber-600 uppercase tracking-wide">Capabilities</div>
            <h2 class="text-3xl sm:text-4xl xl:text-5xl font-semibold mt-4">Everything your product team needs</h2>
            <p class="mt-4 text-lg xl:text-xl text-slate-600 max-w-xl xl:max-w-2xl">
              Built to remove stakeholder noise while keeping execution clear.
            </p>
            <div class="mt-8 inline-flex items-center gap-3 text-sm text-slate-600">
              <span class="pill pill--amber">Live updates</span>
              <span class="pill pill--emerald">AI teammate</span>
            </div>
          </div>
          <div class="space-y-6 xl:space-y-8 scroll-reveal" style="--d: 120ms">
            <div
              v-for="cap in capabilityCards"
              :key="cap.title"
              class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-6 pb-6 border-b border-slate-200 last:border-b-0"
            >
              <div>
                <h3 class="text-lg font-semibold text-slate-900 sm:whitespace-nowrap">{{ cap.title }}</h3>
                <p class="mt-2 text-sm text-slate-600 sm:whitespace-nowrap">{{ cap.body }}</p>
              </div>
              <div class="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section
      id="cta"
      :ref="(el) => (sectionRefs.cta = el as HTMLElement | null)"
      class="px-6 pt-10 pb-20 xl:pt-12 xl:pb-24 bg-slate-50/60 scroll-mt-20 section-reveal"
    >
      <div class="max-w-4xl 2xl:max-w-5xl mx-auto text-center w-full flex flex-col items-center justify-center scroll-reveal" style="--d: 0ms">
        <h2 class="text-3xl sm:text-4xl xl:text-5xl font-semibold text-slate-900">Start a stakeholder-calm workspace</h2>
        <p class="mt-4 text-lg xl:text-xl text-slate-600">Get started free in minutes. No credit card required.</p>
        <NuxtLink
          to="/onboarding"
          class="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
        >
          Get started free
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
          <span class="text-sm text-slate-500">(c) 2026 Relai</span>
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

<style scoped>
.hero-section {
  background-image:
    radial-gradient(55% 45% at 85% 20%, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0)),
    linear-gradient(120deg, rgba(16, 185, 129, 0.24) 0%, rgba(255, 255, 255, 0.96) 45%),
    linear-gradient(300deg, rgba(56, 189, 248, 0.2) 0%, rgba(255, 255, 255, 0.96) 55%),
    linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
}

.signal-chip {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.85);
  color: #475569;
  font-weight: 600;
  letter-spacing: 0.01em;
  padding: 0.42rem 0.78rem;
}

.hero-visual-shell {
  border-radius: 26px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
  padding: 12px;
}

.proof-shell {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background:
    radial-gradient(140% 120% at 15% 0%, rgba(56, 189, 248, 0.1), rgba(56, 189, 248, 0)),
    radial-gradient(140% 120% at 85% 0%, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0)),
    #ffffff;
  box-shadow: 0 20px 56px rgba(15, 23, 42, 0.08);
  padding: 22px;
}

.proof-kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #64748b;
}

.proof-kicker::after {
  content: '';
  width: 56px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.9), rgba(16, 185, 129, 0.8));
}

.proof-stat {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  padding: 18px 20px;
}

.proof-value {
  display: inline-block;
  font-size: clamp(2rem, 2.7vw, 2.8rem);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
  background-image: linear-gradient(140deg, #0f172a, #334155);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
}

.proof-stat:nth-child(1) .proof-value {
  background-image: linear-gradient(140deg, #0f172a, #0369a1);
}

.proof-stat:nth-child(2) .proof-value {
  background-image: linear-gradient(140deg, #0f172a, #047857);
}

.proof-stat:nth-child(3) .proof-value {
  background-image: linear-gradient(140deg, #0f172a, #a16207);
}

.proof-quote {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  padding: 18px 20px;
}

.proof-tags {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-content: center;
}

.proof-tag {
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.96);
  padding: 9px 11px;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
}

.hero-bubbles {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-bubble {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
  padding: 22px 24px;
  backdrop-filter: blur(10px);
  width: 100%;
}

.recursive-stack {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), white);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.1);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recursive-card {
  position: relative;
  margin-left: calc(var(--level, 0) * 18px);
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: white;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.recursive-card--root {
  margin-left: 0;
}

.recursive-connector {
  position: absolute;
  left: -14px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(148, 163, 184, 0.6), rgba(148, 163, 184, 0.15));
}

.recursive-rollup {
  margin-top: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  background: rgba(248, 250, 252, 0.7);
}

.pill {
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 600;
}

.pill--amber {
  background: rgba(251, 191, 36, 0.2);
  color: #b45309;
}

.pill--emerald {
  background: rgba(16, 185, 129, 0.15);
  color: #047857;
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
  background-image: linear-gradient(120deg, #64748b, #94a3b8, #4ade80);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  background-size: var(--accent-width, 100%) 100%;
  background-position: var(--accent-x, 0) 0;
}

.is-ready .word-animate {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

.section-reveal .scroll-reveal {
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

.section-reveal.is-visible .scroll-reveal {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

@media (max-width: 640px) {
  .proof-shell {
    padding: 16px;
  }

  .hero-visual-shell {
    padding: 8px;
  }

  .hero-bubble {
    padding: 18px 20px;
  }

  .recursive-stack {
    padding: 18px;
  }

  .recursive-card {
    margin-left: calc(var(--level, 0) * 10px);
  }
}

@media (min-width: 1536px) {
  .hero-bubble {
    padding: 26px 28px;
  }

  .recursive-stack {
    padding: 26px;
  }

  .recursive-card {
    padding: 16px 18px;
  }
}

</style>
