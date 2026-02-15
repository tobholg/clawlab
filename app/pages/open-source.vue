<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  title: 'Context — Open-Source Project Management for AI Agent Teams',
  meta: [
    { name: 'description', content: 'Free, open-source project management with AI agent teammates. One recursive model, self-hosted, no vendor lock-in. Built for solo devs and teams running AI agents.' },
  ],
  bodyAttrs: { style: 'background-color: #050506' },
})

const navItems = [
  { id: 'agents', label: 'Agents' },
  { id: 'features', label: 'Features' },
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'support', label: 'Support' },
]

const showcaseFeatures = [
  { icon: 'heroicons:queue-list', title: 'Recursive everything', desc: 'Projects, tasks, subtasks — turtles all the way down. One model, infinite depth, automatic roll-up.', screenshots: ['/screenshots/board_1.png', '/screenshots/board_2.png', '/screenshots/board_3.png'] },
  { icon: 'heroicons:chat-bubble-left-right', title: 'Built-in channels', desc: 'Project-linked chat. AI summarizes threads, extracts action items. Context next to the work.', screenshots: ['/screenshots/channel_1.png', '/screenshots/channel_2.png'] },
  { icon: 'heroicons:megaphone', title: 'Stakeholder mode', desc: 'External spaces for normies. They see what you want. Auto-published weekly briefs.', screenshots: ['/screenshots/stakeholder_1.png', '/screenshots/stakeholder_2.png'] },
  { icon: 'heroicons:clock', title: 'Focus tracking', desc: 'Deep work, meetings, admin, learning, break. Know where your time goes. Spot burnout early.', screenshots: ['/screenshots/focus_1.png'] },
]

// Per-feature active screenshot index
const activeScreenshots = reactive<Record<number, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 })


const quickStartSteps = [
  { num: '01', title: 'Clone it', cmd: 'git clone https://github.com/recursion-endeavours/context.git && cd context && npm install', desc: '' },
  { num: '02', title: 'Configure', cmd: 'cp .env.example .env', desc: 'Point it at a Postgres database and set a JWT secret. That\'s it.' },
  { num: '03', title: 'Run it', cmd: 'npm run db:push && npm run dev', desc: 'Open localhost:3000. You\'re done.' },
]

const donationTiers = [
  { amount: '$5', label: 'Buy the maintainer a coffee', emoji: '\u2615' },
  { amount: '$25', label: 'Keep the servers warm for a month', emoji: '\uD83D\uDD25' },
  { amount: '$100', label: 'Fund a feature sprint', emoji: '\uD83D\uDE80' },
]

const marqueeItems = [
  'Solo Devs', 'Indie Hackers', 'Startups', 'Engineering Teams', 'Open Source Projects',
  'Agencies', 'AI Agent Builders', 'Platform Teams', 'Consultants', 'Side Projects',
]

const sectionRefs = reactive<Record<string, HTMLElement | null>>({
  hero: null,
  agents: null,
  features: null,
  quickstart: null,
  support: null,
  sponsors: null,
})

const activeSection = ref('hero')
const ready = ref(false)
const scrolled = ref(false)
const copied = ref(false)

// Screenshot modal
const lightbox = ref<{ featureIndex: number; rect: DOMRect; offsetX: number; offsetY: number; scale: number } | null>(null)
const lightboxOpen = ref(false)
const lightboxImageIndex = ref(0)

const openLightbox = (featureIndex: number, event: Event) => {
  const el = (event.currentTarget as HTMLElement)
  const rect = el.getBoundingClientRect()
  const viewW = window.innerWidth
  const viewH = window.innerHeight
  const targetW = Math.min(viewW * 0.95, 1600)
  const scaleX = rect.width / targetW
  const offsetX = (rect.left + rect.width / 2) - viewW / 2
  const offsetY = (rect.top + rect.height / 2) - viewH / 2
  lightboxImageIndex.value = activeScreenshots[featureIndex]
  lightbox.value = { featureIndex, rect, offsetX, offsetY, scale: scaleX }
  requestAnimationFrame(() => {
    lightboxOpen.value = true
  })
}

const closeLightbox = () => {
  lightboxOpen.value = false
  setTimeout(() => {
    lightbox.value = null
  }, 350)
}

const lightboxFeature = computed(() => lightbox.value ? showcaseFeatures[lightbox.value.featureIndex] : null)

const setLightboxImage = (index: number) => {
  lightboxImageIndex.value = index
  if (lightbox.value) {
    activeScreenshots[lightbox.value.featureIndex] = index
  }
}

// Transition direction for screenshot flips
const screenshotDirection = ref<'next' | 'prev'>('next')

const setScreenshot = (featureIndex: number, imageIndex: number) => {
  screenshotDirection.value = imageIndex > activeScreenshots[featureIndex] ? 'next' : 'prev'
  activeScreenshots[featureIndex] = imageIndex
}

const handleLightboxClick = (event: MouseEvent) => {
  if (!lightbox.value || !lightboxFeature.value) return
  const screenshots = lightboxFeature.value.screenshots
  if (screenshots.length <= 1) return
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const clickX = (event.clientX - rect.left) / rect.width
  const len = screenshots.length
  if (clickX < 0.3) {
    setLightboxImage((lightboxImageIndex.value - 1 + len) % len)
  } else if (clickX > 0.7) {
    setLightboxImage((lightboxImageIndex.value + 1) % len)
  }
}

const copyCommand = async () => {
  try {
    await navigator.clipboard.writeText('npx create-context-app@latest')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

const scrollToSection = (id: string) => {
  const el = sectionRefs[id]
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 60
  window.scrollTo({ top, behavior: 'smooth' })
}

onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })

  const onScroll = () => { scrolled.value = window.scrollY > 20 }
  window.addEventListener('scroll', onScroll, { passive: true })

  // Nav active section tracking only — no animation triggering
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) activeSection.value = visible[0].target.id
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
  })
})
</script>

<template>
  <div class="os-landing min-h-screen text-zinc-100 scroll-smooth" :class="{ 'is-ready': ready }">
    <div class="fixed inset-0 bg-gradient-to-b from-[#050506] to-[#0f0f18] -z-10" aria-hidden="true" />
    <!-- Nav -->
    <nav
      class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl nav-intro border-b transition-all duration-300"
      :class="scrolled ? 'bg-[#050506]/80 border-white/[0.06]' : 'bg-transparent border-transparent'"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-[56px] sm:h-[64px] flex items-center justify-between">
        <div class="flex items-center gap-8">
          <button @click="scrollToSection('hero')" class="flex items-center gap-2 sm:gap-2.5 cursor-pointer">
            <div class="w-7 h-7 sm:w-8 sm:h-8 bg-white/[0.08] rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="text-base sm:text-lg font-semibold tracking-tight text-zinc-100">Context</span>
          </button>
          <div class="hidden md:flex items-center gap-6 text-sm text-zinc-500">
            <button
              v-for="item in navItems"
              :key="item.id"
              class="transition-colors duration-200 cursor-pointer"
              :class="activeSection === item.id ? 'text-zinc-100 font-medium' : 'hover:text-zinc-300'"
              @click="scrollToSection(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3 sm:gap-4">
          <a href="#" class="hidden sm:inline-flex text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Docs</a>
          <a
            href="https://github.com/recursion-endeavours/context"
            target="_blank"
            rel="noopener"
            class="inline-flex sm:hidden items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-all"
          >
            <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>
          <a
            href="https://github.com/recursion-endeavours/context"
            target="_blank"
            rel="noopener"
            class="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-sm text-zinc-300 hover:border-white/[0.15] hover:text-zinc-100 transition-all"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            Star
          </a>
          <NuxtLink
            to="/onboarding"
            class="inline-flex px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-500 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section
      id="hero"
      :ref="(el) => (sectionRefs.hero = el as HTMLElement | null)"
      class="hero-dark relative flex flex-col items-center justify-center px-6 pt-24 sm:pt-32 lg:pt-40 pb-12 sm:pb-16 min-h-0 overflow-hidden scroll-mt-20"
    >

      <div class="relative max-w-4xl mx-auto text-center">
        <!-- Logo -->
        <div class="intro flex justify-center mb-6 sm:mb-8" style="--d: 30ms">
          <div class="w-16 h-16 sm:w-24 sm:h-24 bg-white/[0.06] rounded-xl sm:rounded-3xl flex items-center justify-center">
            <svg class="w-9 h-9 sm:w-14 sm:h-14" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <h1 class="text-3xl font-semibold sm:text-5xl sm:font-medium md:text-6xl lg:text-7xl tracking-tight leading-[1.1]">
          <span class="word-animate text-zinc-100" style="--d: 55ms">One</span>
          <span class="word-animate text-zinc-100" style="--d: 110ms">workspace</span>
          <br />
          <span class="accent-line intro" style="--d: 180ms">for humans and agents.</span>
        </h1>

        <p class="mt-4 text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed intro" style="--d: 340ms">
          One recursive model. AI agents as actual teammates. Self-host, run anywhere. No vendor lock-in, no telemetry, no bullshit.
        </p>
        <p class="mt-3 text-sm text-zinc-500 intro" style="--d: 380ms">
          Yes, this page was made by a clanker — let's move on. 🦞
        </p>

        <!-- CLI quick-start -->
        <div class="mt-6 flex justify-center intro" style="--d: 400ms">
          <div class="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-lg border border-white/[0.08] bg-[#111113] font-mono text-xs sm:text-sm">
            <span class="text-zinc-500 select-none">$</span>
            <span class="text-zinc-300">npx create-context-app@latest</span>
            <button
              type="button"
              class="ml-2 p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              @click="copyCommand"
            >
              <Icon :name="copied ? 'heroicons:check' : 'heroicons:clipboard'" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- CTAs -->
        <div class="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 intro" style="--d: 460ms">
          <NuxtLink
            to="/onboarding"
            class="inline-flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            Get Started
            <Icon name="heroicons:arrow-right" class="w-4 h-4" />
          </NuxtLink>
          <a
            href="https://github.com/recursion-endeavours/context"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto border border-white/[0.1] text-zinc-300 font-medium rounded-lg hover:border-white/[0.2] hover:text-zinc-100 transition-all"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>
      </div>
    </section>

    <!-- Hero Marquee -->
    <div class="px-6 intro" style="--d: 500ms">
      <div class="hero-marquee-container hero-marquee-mask max-w-5xl mx-auto relative overflow-hidden py-4">
        <div class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest text-center mb-3">Built for</div>
        <div class="marquee-track-dark">
          <template v-for="copy in 4" :key="'hero-copy-' + copy">
            <template v-for="item in marqueeItems" :key="'hero-' + item + '-' + copy">
              <span class="marquee-dot-dark" />
              <span class="marquee-label-dark">{{ item }}</span>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- Agent Teammates -->
    <section
      id="agents"
      :ref="(el) => (sectionRefs.agents = el as HTMLElement | null)"
      class="px-6 py-10 lg:py-14 scroll-mt-20"
    >
      <div class="max-w-5xl mx-auto">
        <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <!-- Copy -->
          <div class="intro" style="--d: 520ms">
            <div class="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-3">
              <Icon name="heroicons:cpu-chip" class="w-4 h-4" />
              Agent Teammates
            </div>
            <h2 class="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Your agents work here too</h2>
            <p class="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md">
              Assign tasks to agents or mark them as agent-eligible. They pick up work, break it down, open PRs, and post updates — but only when you say so.
            </p>
          </div>

          <!-- Terminal mockup -->
          <div class="intro" style="--d: 580ms">
            <div class="rounded-xl border border-white/[0.06] bg-[#111113] p-4 space-y-2 font-mono text-[13px]">
              <div class="text-zinc-500 text-[11px] mb-3">openclaw-01</div>
              <div><span class="text-emerald-400">→</span> <span class="text-zinc-400">Picked up</span> <span class="text-zinc-300">Implement payment webhooks</span></div>
              <div><span class="text-emerald-400">→</span> <span class="text-zinc-400">Created 3 subtasks</span></div>
              <div><span class="text-emerald-400">→</span> <span class="text-zinc-400">PR #247 opened</span> <span class="text-zinc-500">feature/payment-webhooks</span></div>
              <div><span class="text-emerald-400">→</span> <span class="text-zinc-300">Done. Next task.</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Core Features -->
    <section
      id="features"
      :ref="(el) => (sectionRefs.features = el as HTMLElement | null)"
      class="px-6 py-10 lg:py-14 scroll-mt-20"
    >
      <div class="max-w-6xl mx-auto">
        <div class="text-center intro" style="--d: 640ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Features</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Everything you need,<br class="sm:hidden" /> nothing you don't</h2>
          <p class="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
            Built for people who ship. No feature bloat, no enterprise theater.
          </p>
        </div>

        <!-- Showcase features: alternating image/text rows -->
        <div class="mt-12 space-y-16 lg:space-y-20">
          <div
            v-for="(feat, i) in showcaseFeatures"
            :key="feat.title"
            class="grid gap-8 lg:gap-12 items-center intro"
            :class="i % 2 === 1 ? 'lg:grid-cols-[7fr_5fr]' : 'lg:grid-cols-[5fr_7fr]'"
            :style="{ '--d': `${700 + i * 80}ms` }"
          >
            <!-- Text -->
            <div :class="i % 2 === 1 ? 'lg:order-2' : ''">
              <div class="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <Icon :name="feat.icon" class="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <h3 class="text-xl sm:text-2xl font-semibold text-zinc-100">{{ feat.title }}</h3>
              <p class="mt-2 text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md">{{ feat.desc }}</p>
            </div>
            <!-- Screenshots -->
            <div :class="i % 2 === 1 ? 'lg:order-1' : ''">
              <div
                class="rounded-xl border border-white/[0.06] bg-black overflow-hidden cursor-pointer hover:border-white/[0.1] transition-all relative"
                @click="openLightbox(i, $event)"
              >
                <Transition name="screenshot-fade" mode="out-in">
                  <img
                    :key="feat.screenshots[activeScreenshots[i]]"
                    :src="feat.screenshots[activeScreenshots[i]]"
                    :alt="feat.title"
                    class="w-full h-auto screenshot-crisp"
                  />
                </Transition>
              </div>
              <!-- Dots -->
              <div v-if="feat.screenshots.length > 1" class="flex items-center justify-center gap-1.5 mt-3">
                <button
                  v-for="(_, si) in feat.screenshots"
                  :key="si"
                  class="w-1.5 h-1.5 rounded-full transition-all cursor-pointer"
                  :class="activeScreenshots[i] === si ? 'bg-emerald-400 w-4' : 'bg-zinc-600 hover:bg-zinc-500'"
                  @click="setScreenshot(i, si)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Start -->
    <section
      id="quickstart"
      :ref="(el) => (sectionRefs.quickstart = el as HTMLElement | null)"
      class="px-6 py-10 lg:py-14 scroll-mt-20"
    >
      <div class="max-w-3xl mx-auto">
        <div class="text-center intro" style="--d: 960ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Quick Start</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Up and running in 2 minutes</h2>
          <p class="mt-3 text-lg text-zinc-400">
            Seriously. Clone, configure, run.
          </p>
        </div>

        <div class="mt-8 relative">
          <!-- Vertical line -->
          <div class="absolute left-[19px] top-8 bottom-[4.5rem] w-px bg-white/[0.06]" />

          <div class="space-y-6">
            <div
              v-for="(step, i) in quickStartSteps"
              :key="step.num"
              class="flex gap-6 intro"
              :style="{ '--d': `${1020 + i * 60}ms` }"
            >
              <div class="relative flex-shrink-0 w-10 h-10 rounded-full border border-white/[0.1] bg-[#111113] flex items-center justify-center text-sm font-mono font-semibold text-emerald-400 z-10">
                {{ step.num }}
              </div>
              <div class="flex-1 pt-1">
                <h3 class="text-base font-semibold text-zinc-100">{{ step.title }}</h3>
                <div class="mt-2 rounded-lg border border-white/[0.08] bg-[#111113] px-4 py-2.5 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {{ step.cmd }}
                </div>
                <p v-if="step.desc" class="mt-2 text-sm text-zinc-500">{{ step.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Support the Project -->
    <section
      id="support"
      :ref="(el) => (sectionRefs.support = el as HTMLElement | null)"
      class="px-6 py-10 lg:py-14 scroll-mt-20"
    >
      <div class="max-w-3xl mx-auto">
        <div class="text-center intro" style="--d: 1300ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Support</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Want to keep this thing alive?</h2>
          <p class="mt-3 text-zinc-400 max-w-2xl mx-auto">
            Context is free. Always will be. But servers, coffee, and late nights aren't. If you get value from it, consider throwing some support our way.
          </p>
        </div>

        <div class="mt-8 grid sm:grid-cols-3 gap-4">
          <a
            v-for="(tier, i) in donationTiers"
            :key="tier.amount"
            href="#"
            class="donation-card intro"
            :style="{ '--d': `${1360 + i * 50}ms` }"
          >
            <span class="text-2xl mb-2 block">{{ tier.emoji }}</span>
            <div class="text-xl font-bold text-zinc-100">{{ tier.amount }}</div>
            <p class="mt-1 text-sm text-zinc-400">{{ tier.label }}</p>
          </a>
        </div>

        <p class="mt-4 text-center text-xs text-zinc-600 intro" style="--d: 1500ms">One-time via Stripe. No subscriptions, no guilt.</p>
      </div>
    </section>

    <!-- Sponsor Section -->
    <section
      id="sponsors"
      :ref="(el) => (sectionRefs.sponsors = el as HTMLElement | null)"
      class="px-6 py-10 lg:py-14 border-t border-white/[0.06] scroll-mt-20"
    >
      <div class="max-w-4xl mx-auto">
        <div class="text-center intro" style="--d: 1540ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Sponsors</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Sponsor Context</h2>
          <p class="mt-3 text-zinc-400 max-w-2xl mx-auto">
            We're looking for companies that believe good project management shouldn't require a $50/seat SaaS subscription.
          </p>
        </div>

        <div class="mt-8 intro" style="--d: 1600ms">
          <ul class="grid grid-cols-2 gap-x-8 gap-y-2.5 max-w-md mx-auto">
            <li class="flex items-start gap-2.5">
              <Icon name="heroicons:check" class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-zinc-400 text-sm">Logo on README + website</span>
            </li>
            <li class="flex items-start gap-2.5">
              <Icon name="heroicons:check" class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-zinc-400 text-sm">Priority feature input</span>
            </li>
            <li class="flex items-start gap-2.5">
              <Icon name="heroicons:check" class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-zinc-400 text-sm">Direct line to the core team</span>
            </li>
            <li class="flex items-start gap-2.5">
              <Icon name="heroicons:check" class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span class="text-zinc-400 text-sm">Named in release notes</span>
            </li>
          </ul>

          <div class="mt-6 text-center">
            <a
              href="mailto:hello@recursion-endeavours.com"
              class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              Talk to us
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
            </a>
          </div>

          <!-- Placeholder sponsor logos -->
          <div class="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <div v-for="n in 4" :key="n" class="w-24 h-8 rounded bg-white/[0.06] flex items-center justify-center">
              <span class="text-[10px] text-zinc-600">Your logo here</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-white/[0.06] py-6 px-6">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 bg-white/[0.08] rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="text-sm text-zinc-500">Free &amp; open source project management.</span>
          </div>
          <div class="flex items-center gap-5 text-sm text-zinc-500">
            <a href="https://github.com/recursion-endeavours/context" target="_blank" rel="noopener" class="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </a>
            <a href="#" class="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              Discord
            </a>
            <a href="#" class="flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X
            </a>
          </div>
        </div>
        <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
          <span class="text-xs text-zinc-600">&copy; 2026 Recursion Endeavours AS &middot; BSL 1.1</span>
          <div class="flex items-center gap-5 text-xs text-zinc-600">
            <a href="#" class="hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" class="hover:text-zinc-400 transition-colors">Terms</a>
            <a href="mailto:hello@recursion-endeavours.com" class="hover:text-zinc-400 transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>

    <!-- Screenshot lightbox -->
    <Teleport to="body">
      <div
        v-if="lightbox"
        class="fixed inset-0 z-[100] flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/80 transition-opacity duration-300 cursor-pointer"
          :class="lightboxOpen ? 'opacity-100' : 'opacity-0'"
          @click="closeLightbox"
        />
        <!-- Image container -->
        <div
          class="lightbox-image relative z-10 w-[95vw] max-w-[1600px]"
          :class="lightboxOpen ? 'lightbox-image--open' : 'lightbox-image--closed'"
          :style="{
            '--lb-ox': `${lightbox.offsetX}px`,
            '--lb-oy': `${lightbox.offsetY}px`,
            '--lb-s': lightbox.scale,
          }"
        >
          <button
            class="absolute -top-10 right-0 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            @click="closeLightbox"
          >
            <Icon name="heroicons:x-mark" class="w-6 h-6" />
          </button>
          <div
            class="rounded-xl border border-white/[0.1] bg-black overflow-hidden"
            :class="lightboxFeature && lightboxFeature.screenshots.length > 1 ? 'cursor-pointer' : ''"
            @click="handleLightboxClick($event)"
          >
            <Transition name="screenshot-fade" mode="out-in">
              <img
                :key="lightboxFeature?.screenshots[lightboxImageIndex]"
                :src="lightboxFeature?.screenshots[lightboxImageIndex]"
                :alt="lightboxFeature?.title"
                class="w-full h-auto screenshot-crisp"
              />
            </Transition>
          </div>
          <!-- Lightbox dots -->
          <div v-if="lightboxFeature && lightboxFeature.screenshots.length > 1" class="flex items-center justify-center gap-2 mt-4">
            <button
              v-for="(_, si) in lightboxFeature.screenshots"
              :key="si"
              class="w-2 h-2 rounded-full transition-all cursor-pointer"
              :class="lightboxImageIndex === si ? 'bg-emerald-400 w-5' : 'bg-zinc-600 hover:bg-zinc-400'"
              @click="setLightboxImage(si)"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Force dark color-scheme for browser chrome */
:deep(html) {
  color-scheme: dark;
}

/* ── Hero ─────────────────────────────────────────── */

.hero-dark {
  background-color: transparent;
}

/* ── Accent line — single gradient across the full line ── */

.accent-line {
  background-image: linear-gradient(120deg, #94a3b8, #e2e8f0, #4ade80);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

/* ── Feature cards ────────────────────────────────── */

/* ── Screenshot transitions ─────────────────────── */

.screenshot-fade-enter-active,
.screenshot-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.screenshot-fade-enter-from {
  opacity: 0;
  transform: scale(0.98);
}

.screenshot-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

.screenshot-crisp {
  image-rendering: high-quality;
}

.feature-card {
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  transition:
    border-color 300ms ease-in-out,
    background 300ms ease-in-out;
}

.feature-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

/* ── Donation cards ───────────────────────────────── */

.donation-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 20px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  transition:
    border-color 300ms ease-in-out,
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 400ms cubic-bezier(0.16, 1, 0.3, 1);
  text-decoration: none;
}

.donation-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
}

/* ── Dark Marquee ─────────────────────────────────── */

.marquee-track-dark {
  display: flex;
  align-items: center;
  gap: 20px;
  width: max-content;
  animation: marquee 45s linear infinite;
}

@property --mq-from {
  syntax: '<color>';
  initial-value: #71717a;
  inherits: false;
}

@property --mq-to {
  syntax: '<color>';
  initial-value: #71717a;
  inherits: false;
}

.marquee-label-dark {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  --mq-from: #71717a;
  --mq-to: #71717a;
  background: linear-gradient(120deg, var(--mq-from), var(--mq-to));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: --mq-from 0.4s ease, --mq-to 0.4s ease;
}

.marquee-label-dark:hover {
  --mq-from: #34d399;
  --mq-to: #6ee7b7;
}

.marquee-dot-dark {
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #3f3f46;
  flex-shrink: 0;
}

.hero-marquee-mask {
  -webkit-mask-image: linear-gradient(to right, transparent, black 120px, black calc(100% - 120px), transparent);
  mask-image: linear-gradient(to right, transparent, black 120px, black calc(100% - 120px), transparent);
}

@media (min-width: 1024px) {
  .hero-marquee-mask {
    -webkit-mask-image: linear-gradient(to right, transparent, black 240px, black calc(100% - 240px), transparent);
    mask-image: linear-gradient(to right, transparent, black 240px, black calc(100% - 240px), transparent);
  }
}

.hero-marquee-container::before,
.hero-marquee-container::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.06) 20%, rgba(255, 255, 255, 0.06) 80%, transparent);
}

.hero-marquee-container::before {
  top: 0;
}

.hero-marquee-container::after {
  bottom: 0;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-25%); }
}

/* ── Lightbox ─────────────────────────────────── */

.lightbox-image {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.lightbox-image--closed {
  opacity: 0;
  transform: translate(var(--lb-ox), var(--lb-oy)) scale(var(--lb-s));
}

.lightbox-image--open {
  opacity: 1;
  transform: translate(0, 0) scale(1);
}

/* ── Intro animation (used for ALL elements, not just hero) ── */

.intro {
  opacity: 0;
  transform: translateY(18px);
  filter: blur(8px);
  transition:
    opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.7s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.7s cubic-bezier(0.16, 1, 0.3, 1);
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
    border-color 0.3s ease;
  will-change: opacity, transform;
}

.is-ready .nav-intro {
  opacity: 1;
  transform: translateY(0);
}

/* ── Word animate (hero headline only) ────────────── */

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
</style>
