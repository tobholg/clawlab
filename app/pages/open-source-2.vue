<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  title: 'Context — Project Management for Human-Agent Teams',
  meta: [
    { name: 'description', content: 'The first open-source project manager built for human-agent teams. Assign tasks to AI agents, review their plans, track their work. Self-hosted, recursive task model, no vendor lock-in.' },
  ],
  bodyAttrs: { style: 'background-color: #0c0c10' },
})

const ready = ref(false)
const scrolled = ref(false)
const copied = ref(false)

// ── Navigation ──
const navItems = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'features', label: 'Features' },
  { id: 'compare', label: 'Compare' },
  { id: 'get-started', label: 'Get Started' },
]

const sectionRefs = reactive<Record<string, HTMLElement | null>>({
  hero: null,
  'how-it-works': null,
  features: null,
  compare: null,
  'get-started': null,
})
const activeSection = ref('hero')

const scrollToSection = (id: string) => {
  const el = sectionRefs[id]
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 72
  window.scrollTo({ top, behavior: 'smooth' })
}

// ── Terminal replay ──
interface TermLine {
  text: string
  delay: number
  isCommand?: boolean
  isResult?: boolean
  isBlank?: boolean
  color?: string
  toast?: { agent: string; text: string; color: string }
}

const terminalLines: TermLine[] = [
  { text: '$ ctx task 7f3a --get', delay: 400, isCommand: true },
  { text: '  Implement payment webhooks', delay: 100, color: 'zinc' },
  { text: '  Status: TODO  Mode: PLAN  Assigned: harriet', delay: 600, color: 'muted' },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx docs 7f3a --create "Implementation Plan"', delay: 400, isCommand: true },
  { text: '  Created doc d1 on task 7f3a', delay: 600, isResult: true },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task 7f3a --status active', delay: 400, isCommand: true },
  { text: '  Status -> IN_PROGRESS/scoping', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Status changed: TODO -> In Progress (scoping)', color: 'amber' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx subtask 7f3a "Set up Stripe webhook endpoint"', delay: 400, isCommand: true },
  { text: '  Created subtask abc1', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Created subtask: Set up Stripe webhook endpoint', color: 'amber' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx subtask 7f3a "Handle subscription events"', delay: 400, isCommand: true },
  { text: '  Created subtask abc2', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Created subtask: Handle subscription events', color: 'amber' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task abc1 --status done', delay: 400, isCommand: true },
  { text: '  abc1 -> IN_PROGRESS/review', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Subtask completed: Set up Stripe webhook endpoint', color: 'emerald' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task 7f3a --progress 75', delay: 400, isCommand: true },
  { text: '  Progress updated: 0% -> 75%', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Progress updated: 0% -> 75%', color: 'emerald' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task abc2 --status done', delay: 400, isCommand: true },
  { text: '  abc2 -> IN_PROGRESS/review', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Subtask completed: Handle subscription events', color: 'emerald' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task 7f3a --progress 100 --status done', delay: 400, isCommand: true },
  { text: '  7f3a -> IN_PROGRESS/review (100%)', delay: 800, isResult: true,
    toast: { agent: 'H', text: 'Submitted for review — all subtasks complete', color: 'blue' } },
]

const terminalVisibleCount = ref(0)
const terminalStarted = ref(false)
const terminalCursorChar = ref(0)
const terminalTypingLine = ref(-1)
const terminalEl = ref<HTMLElement | null>(null)
const cliToasts = ref<{ agent: string; text: string; color: string; id: number }[]>([])
let cliToastId = 0
let terminalAbort = false
const termFading = ref(false)

const scrollTerminal = () => {
  nextTick(() => {
    if (terminalEl.value) terminalEl.value.scrollTop = terminalEl.value.scrollHeight
  })
}

watch(terminalVisibleCount, scrollTerminal)
watch(terminalCursorChar, scrollTerminal)

const addCliToast = (t: { agent: string; text: string; color: string }) => {
  cliToasts.value.push({ ...t, id: ++cliToastId })
  if (cliToasts.value.length > 5) cliToasts.value.shift()
}

const typeCommand = (lineIndex: number): Promise<void> => {
  return new Promise((resolve) => {
    const line = terminalLines[lineIndex]
    if (!line) { resolve(); return }
    terminalTypingLine.value = lineIndex
    terminalCursorChar.value = 0
    const text = line.text
    let charIndex = 0
    const typeInterval = setInterval(() => {
      if (terminalAbort) { clearInterval(typeInterval); resolve(); return }
      charIndex++
      terminalCursorChar.value = charIndex
      if (charIndex >= text.length) {
        clearInterval(typeInterval)
        terminalTypingLine.value = -1
        terminalVisibleCount.value = lineIndex + 1
        resolve()
      }
    }, 30)
  })
}

const showLine = (lineIndex: number): Promise<void> => {
  return new Promise((resolve) => {
    terminalVisibleCount.value = lineIndex + 1
    const line = terminalLines[lineIndex]
    if (line.toast) {
      setTimeout(() => addCliToast(line.toast!), 300)
    }
    resolve()
  })
}

const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

const startTerminalReplay = async () => {
  if (terminalStarted.value) return
  terminalStarted.value = true
  terminalAbort = false
  terminalVisibleCount.value = 0
  terminalCursorChar.value = 0
  terminalTypingLine.value = -1
  cliToasts.value = []

  for (let i = 0; i < terminalLines.length; i++) {
    if (terminalAbort) break
    const line = terminalLines[i]
    if (line.isCommand) {
      await typeCommand(i)
      await wait(line.delay)
    } else {
      await showLine(i)
      await wait(line.delay)
    }
  }

  await wait(3000)
  termFading.value = true
  await wait(800)
  terminalVisibleCount.value = 0
  terminalCursorChar.value = 0
  terminalTypingLine.value = -1
  cliToasts.value = []
  terminalStarted.value = false
  termFading.value = false
  await wait(400)
  startTerminalReplay()
}

// ── Comparison data ──
const comparisonRows = [
  { feature: 'AI agents as teammates', context: true, linear: false, jira: false },
  { feature: 'Plan/execute lifecycle', context: true, linear: false, jira: false },
  { feature: 'Agent CLI & REST API', context: true, linear: false, jira: false },
  { feature: 'Recursive task model', context: true, linear: false, jira: false },
  { feature: 'Auto-bubbling progress', context: true, linear: false, jira: false },
  { feature: 'Self-hosted', context: true, linear: false, jira: true },
  { feature: 'Open source', context: true, linear: false, jira: false },
  { feature: 'Stakeholder portals', context: true, linear: false, jira: true },
  { feature: 'Built-in chat', context: true, linear: false, jira: false },
  { feature: 'Free forever', context: true, linear: false, jira: false },
]

// ── Quick start ──
const quickStartSteps = [
  { num: '01', title: 'Clone it', cmd: 'git clone https://github.com/recursion-endeavours/context.git && cd context && npm install', desc: '' },
  { num: '02', title: 'Configure', cmd: 'cp .env.example .env', desc: 'Set a JWT secret. PGlite runs embedded by default, no database setup needed.' },
  { num: '03', title: 'Run it', cmd: 'npm run dev', desc: 'Open localhost:3000. Create a workspace. Assign your first agent.' },
]

const copyCommand = async () => {
  try {
    await navigator.clipboard.writeText('npx create-context-app@latest')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

// ── Visible section tracking ──
onMounted(() => {
  requestAnimationFrame(() => { ready.value = true })

  const onScroll = () => { scrolled.value = window.scrollY > 64 }
  window.addEventListener('scroll', onScroll, { passive: true })

  // Terminal replay trigger
  const termEl = document.getElementById('terminal-replay-2')
  const terminalObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) startTerminalReplay() })
  }, { threshold: 0.3 })
  if (termEl) terminalObs.observe(termEl)

  // Section tracking
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) activeSection.value = visible[0].target.id
    },
    { rootMargin: '-20% 0px -55% 0px', threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  )

  nextTick(() => {
    Object.values(sectionRefs).forEach((el) => {
      if (el) observer.observe(el)
    })
  })

  onUnmounted(() => {
    observer.disconnect()
    terminalObs.disconnect()
    window.removeEventListener('scroll', onScroll)
  })
})
</script>

<template>
  <div class="os2 min-h-screen text-zinc-100 scroll-smooth" :class="{ 'is-ready': ready }">
    <!-- Gradient mesh background -->
    <div class="fixed inset-0 -z-10 bg-[#0c0c10]" aria-hidden="true">
      <div class="absolute top-[60vh] right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-violet-500/[0.05] via-blue-500/[0.03] to-transparent blur-[100px]" />
      <div class="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-amber-500/[0.04] to-transparent blur-[100px]" />
    </div>

    <!-- Nav -->
    <nav
      class="fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-out"
      :class="scrolled ? 'bg-[#0c0c10]/80 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent border-b border-transparent'"
    >
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-10">
          <button @click="scrollToSection('hero')" class="flex items-center gap-2.5 cursor-pointer group">
            <div class="w-8 h-8 bg-white/[0.06] rounded-xl flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
              <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="text-[17px] tracking-tight"><span class="font-semibold text-white">open</span><span class="font-normal text-zinc-400">context</span></span>
          </button>
          <div class="hidden md:flex items-center gap-1">
            <button
              v-for="item in navItems"
              :key="item.id"
              class="px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 cursor-pointer"
              :class="activeSection === item.id ? 'text-zinc-100 bg-white/[0.06]' : 'text-zinc-500 hover:text-zinc-300'"
              @click="scrollToSection(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <a
            href="https://github.com/recursion-endeavours/context"
            target="_blank"
            rel="noopener"
            class="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
          <NuxtLink
            to="/onboarding"
            class="inline-flex items-center px-4 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- ═══════════════════════ HERO ═══════════════════════ -->
    <section
      id="hero"
      :ref="(el) => (sectionRefs.hero = el as HTMLElement | null)"
      class="hero-clip relative flex flex-col items-center justify-center px-6 min-h-screen scroll-mt-20 overflow-hidden"
    >
      <StarField :delay="400" />
      <div class="absolute inset-0 pointer-events-none" style="z-index: 0; background: linear-gradient(to bottom, transparent 35%, rgba(9,9,11,0.4) 55%, rgba(9,9,11,0.7) 75%, rgba(9,9,11,0.85) 100%)" />

      <!-- Bottom arc glow — concave (taller on sides, fades up) -->
      <div class="hero-arc" aria-hidden="true">
        <div class="hero-arc-left" />
        <div class="hero-arc-right" />
        <div class="hero-arc-center" />
      </div>

      <!-- Badge -->
      <div class="intro mb-6" style="--d: 0ms">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400 text-xs font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Open Source &middot; Self-Hosted &middot; Free Forever
        </div>
      </div>

      <!-- Headline -->
      <h1 class="intro text-center text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.05]" style="--d: 80ms">
        <span class="text-zinc-100">Your agents finally</span>
        <br />
        <span class="hero-gradient">have a workspace.</span>
      </h1>

      <!-- Subtitle -->
      <p class="intro mt-6 text-center text-lg sm:text-xl text-zinc-400 max-w-2xl leading-relaxed" style="--d: 200ms">
        Open-source project management for human-agent teams.
        Assign tasks, review plans, ship together.
      </p>

      <!-- CTAs -->
      <div class="intro mt-10 flex flex-col sm:flex-row items-center gap-4" style="--d: 320ms">
        <NuxtLink
          to="/onboarding"
          class="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-all shadow-lg shadow-white/[0.08] text-sm"
        >
          Start Building
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
        </NuxtLink>
        <a
          href="https://github.com/recursion-endeavours/context"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2.5 px-7 py-3.5 border border-white/[0.1] text-zinc-300 font-semibold rounded-xl hover:border-white/[0.2] hover:bg-white/[0.04] transition-all text-sm"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          View on GitHub
        </a>
      </div>

      <!-- CLI command -->
      <div class="intro mt-8" style="--d: 420ms">
        <button
          @click="copyCommand"
          class="group inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer"
        >
          <span class="font-mono text-sm text-zinc-500">$</span>
          <span class="font-mono text-sm text-zinc-300">npx create-context-app@latest</span>
          <span class="text-zinc-600 group-hover:text-zinc-400 transition-colors">
            <Icon :name="copied ? 'heroicons:check' : 'heroicons:clipboard'" class="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      <!-- Agent logos -->
      <div class="intro mt-16 flex flex-col items-center gap-4" style="--d: 520ms">
        <p class="text-xs text-zinc-600 uppercase tracking-widest font-medium">Works with any agent</p>
        <div class="flex items-center gap-5">
          <div class="flex items-center gap-2 text-sm text-zinc-500">
            <img src="/logos/openclaw.png" alt="OpenClaw" class="w-8 h-8 rounded-lg" />
            OpenClaw
          </div>
          <div class="w-px h-4 bg-white/[0.06]" />
          <div class="flex items-center gap-2 text-sm text-zinc-500">
            <img src="/logos/openai.png" alt="OpenAI" class="w-8 h-8 rounded-lg" />
            Codex
          </div>
          <div class="w-px h-4 bg-white/[0.06]" />
          <div class="flex items-center gap-2 text-sm text-zinc-500">
            <img src="/logos/anthropic.png" alt="Anthropic" class="w-8 h-8 rounded-lg" />
            Claude Code
          </div>
          <div class="w-px h-4 bg-white/[0.06] hidden sm:block" />
          <div class="hidden sm:flex items-center gap-2 text-sm text-zinc-500">
            <div class="w-8 h-8 rounded-lg bg-zinc-500/10 flex items-center justify-center"><span class="text-xs font-bold text-zinc-500">+</span></div>
            Your Agent
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ HOW IT WORKS ═══════════════════════ -->
    <section
      id="how-it-works"
      :ref="(el) => (sectionRefs['how-it-works'] = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-32 scroll-mt-20"
    >
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <p class="intro text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4" style="--d: 0ms">How It Works</p>
          <h2 class="intro text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight" style="--d: 60ms">
            Agents that actually <span class="text-emerald-400">ship</span>
          </h2>
          <p class="intro mt-4 text-zinc-400 text-lg max-w-2xl mx-auto" style="--d: 120ms">
            Not a chatbot sidebar. A full lifecycle: assign, plan, execute, review, done.
          </p>
        </div>

        <!-- Three walkthrough cards -->
        <div class="grid md:grid-cols-3 gap-6">
          <div class="intro group" style="--d: 180ms">
            <div class="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 h-full hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300">
              <div class="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                <Icon name="heroicons:clipboard-document-list" class="w-6 h-6 text-amber-400" />
              </div>
              <div class="text-xs font-mono text-zinc-600 mb-2">01</div>
              <h3 class="text-xl font-semibold text-zinc-100 mb-3">Assign the task</h3>
              <p class="text-sm text-zinc-400 leading-relaxed">
                Create a task and assign it to an agent. Set the scope, link dependencies, define acceptance criteria. Same workflow as any human teammate.
              </p>
            </div>
          </div>

          <div class="intro group" style="--d: 260ms">
            <div class="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 h-full hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300">
              <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                <Icon name="heroicons:document-magnifying-glass" class="w-6 h-6 text-blue-400" />
              </div>
              <div class="text-xs font-mono text-zinc-600 mb-2">02</div>
              <h3 class="text-xl font-semibold text-zinc-100 mb-3">Review the plan</h3>
              <p class="text-sm text-zinc-400 leading-relaxed">
                The agent creates a plan with subtasks. You review, approve, or request changes before any code is written. Humans stay in the loop.
              </p>
            </div>
          </div>

          <div class="intro group" style="--d: 340ms">
            <div class="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 h-full hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300">
              <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <Icon name="heroicons:rocket-launch" class="w-6 h-6 text-emerald-400" />
              </div>
              <div class="text-xs font-mono text-zinc-600 mb-2">03</div>
              <h3 class="text-xl font-semibold text-zinc-100 mb-3">Watch it ship</h3>
              <p class="text-sm text-zinc-400 leading-relaxed">
                Track real-time progress as subtasks complete. Progress bubbles up automatically. Get notified when it's ready for review.
              </p>
            </div>
          </div>
        </div>

        <!-- Terminal demo -->
        <div class="mt-20">
          <div class="text-center mb-10">
            <p class="intro text-sm text-zinc-500 mb-2" style="--d: 400ms">See it in action</p>
            <h3 class="intro text-2xl sm:text-3xl font-semibold tracking-tight" style="--d: 440ms">Two perspectives, one workflow</h3>
            <p class="intro mt-3 text-zinc-400 max-w-lg mx-auto" style="--d: 480ms">Left: what the agent runs. Right: what you see in real-time.</p>
          </div>

          <div
            id="terminal-replay-2"
            class="intro rounded-2xl border border-white/[0.06] overflow-hidden transition-opacity duration-700"
            style="--d: 520ms"
            :class="termFading ? 'opacity-0' : 'opacity-100'"
          >
            <div class="grid lg:grid-cols-2 gap-0">
              <!-- Agent terminal -->
              <div ref="terminalEl" class="bg-[#0c0c0e] p-6 font-mono text-[13px] border-r border-white/[0.06] overflow-y-auto scroll-smooth h-[420px]">
                <div class="flex items-center gap-1.5 mb-5">
                  <div class="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
                  <div class="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
                  <div class="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
                  <span class="ml-3 text-[11px] text-zinc-600">harriet - ctx agent</span>
                </div>

                <template v-for="(line, i) in terminalLines" :key="i">
                  <div v-if="terminalTypingLine === i" class="terminal-line">
                    <span class="text-zinc-300">{{ line.text.slice(0, terminalCursorChar) }}</span>
                    <span class="terminal-cursor">|</span>
                  </div>
                  <div v-else-if="i < terminalVisibleCount" class="terminal-line">
                    <template v-if="line.isCommand">
                      <span class="text-zinc-300">{{ line.text }}</span>
                    </template>
                    <template v-else-if="line.isBlank">
                      <div class="h-2" />
                    </template>
                    <template v-else-if="line.isResult">
                      <span class="text-emerald-400/80">&#10003;</span>
                      <span class="text-zinc-500"> {{ line.text.replace(/^\s+/, '') }}</span>
                    </template>
                    <template v-else-if="line.color === 'muted'">
                      <span class="text-zinc-600 text-[11px]">{{ line.text }}</span>
                    </template>
                    <template v-else>
                      <span class="text-zinc-400">{{ line.text }}</span>
                    </template>
                  </div>
                </template>
              </div>

              <!-- Notifications panel -->
              <div class="bg-[#0a0a0c] p-6 flex flex-col overflow-hidden h-[420px]">
                <div class="flex items-center gap-2.5 mb-5">
                  <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Live Activity</span>
                </div>
                <div class="flex-1 flex flex-col justify-end gap-3 overflow-hidden">
                  <TransitionGroup name="toast-slide">
                    <div
                      v-for="toast in cliToasts"
                      :key="toast.id"
                      class="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                    >
                      <div class="flex items-start gap-3">
                        <div class="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center ring-1 ring-white/10"
                          :class="{
                            'bg-amber-500/10': toast.color === 'amber',
                            'bg-emerald-500/10': toast.color === 'emerald',
                            'bg-blue-500/10': toast.color === 'blue',
                          }">
                          <span class="text-[11px] font-semibold" :class="{
                            'text-amber-500': toast.color === 'amber',
                            'text-emerald-500': toast.color === 'emerald',
                            'text-blue-500': toast.color === 'blue',
                          }">{{ toast.agent }}</span>
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center justify-between">
                            <p class="text-sm font-semibold text-zinc-200">Harriet</p>
                            <span class="text-[10px] text-zinc-600">now</span>
                          </div>
                          <p class="mt-0.5 text-[11px] text-zinc-600">Payment System</p>
                          <p class="mt-1 text-sm text-zinc-300">{{ toast.text }}</p>
                        </div>
                      </div>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ FEATURES (Bento Grid) ═══════════════════════ -->
    <section
      id="features"
      :ref="(el) => (sectionRefs.features = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-32 scroll-mt-20"
    >
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <p class="intro text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4" style="--d: 0ms">Features</p>
          <h2 class="intro text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight" style="--d: 60ms">
            Everything you need,<br class="hidden sm:inline" /> nothing you don't
          </h2>
          <p class="intro mt-4 text-zinc-400 text-lg max-w-2xl mx-auto" style="--d: 120ms">
            Built for people who ship. No feature bloat, no enterprise theater.
          </p>
        </div>

        <!-- Bento grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Large: Recursive Tasks -->
          <div class="intro lg:col-span-2 group" style="--d: 180ms">
            <div class="relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all duration-300">
              <div class="p-8">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Icon name="heroicons:queue-list" class="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 class="text-lg font-semibold text-zinc-100">Recursive Task Model</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed max-w-lg">
                  Projects contain tasks contain subtasks, infinitely deep. Progress, confidence, and time estimates bubble up automatically from leaves to root.
                </p>
              </div>
              <div class="px-8 pb-6">
                <div class="rounded-xl border border-white/[0.06] bg-[#0c0c0e] p-4 space-y-2">
                  <div class="flex items-center gap-3">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span class="text-sm text-zinc-300 flex-1">Payment System</span>
                    <span class="text-xs text-zinc-600 font-mono">75%</span>
                    <div class="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full bg-emerald-500/60 w-3/4" /></div>
                  </div>
                  <div class="ml-6 flex items-center gap-3">
                    <div class="w-1 h-1 rounded-full bg-blue-400" />
                    <span class="text-[13px] text-zinc-400 flex-1">Stripe webhooks</span>
                    <span class="text-[11px] text-zinc-600 font-mono">100%</span>
                    <div class="w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full bg-blue-500/60 w-full" /></div>
                  </div>
                  <div class="ml-6 flex items-center gap-3">
                    <div class="w-1 h-1 rounded-full bg-amber-400" />
                    <span class="text-[13px] text-zinc-400 flex-1">Subscription events</span>
                    <span class="text-[11px] text-zinc-600 font-mono">50%</span>
                    <div class="w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full bg-amber-500/60 w-1/2" /></div>
                  </div>
                  <div class="ml-12 flex items-center gap-3">
                    <div class="w-0.5 h-0.5 rounded-full bg-zinc-600" />
                    <span class="text-xs text-zinc-500 flex-1">Handle upgrades</span>
                    <span class="text-[10px] text-zinc-700 font-mono">TODO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Agent CLI -->
          <div class="intro group" style="--d: 240ms">
            <div class="relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all duration-300">
              <div class="p-8">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Icon name="heroicons:command-line" class="w-5 h-5 text-violet-400" />
                  </div>
                  <h3 class="text-lg font-semibold text-zinc-100">Agent CLI & API</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  Full CLI and REST API for agents. Create tasks, update status, post messages, attach files. Everything a human can do.
                </p>
              </div>
              <div class="px-8 pb-6">
                <div class="rounded-xl bg-[#0c0c0e] p-3 font-mono text-[11px] text-zinc-500 space-y-1">
                  <div><span class="text-zinc-600">$</span> <span class="text-zinc-400">ctx task --create</span></div>
                  <div><span class="text-zinc-600">$</span> <span class="text-zinc-400">ctx subtask --add</span></div>
                  <div><span class="text-zinc-600">$</span> <span class="text-zinc-400">ctx status --update</span></div>
                  <div><span class="text-zinc-600">$</span> <span class="text-zinc-400">ctx msg --post</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Channels -->
          <div class="intro group" style="--d: 300ms">
            <div class="relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all duration-300">
              <div class="p-8">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Icon name="heroicons:chat-bubble-left-right" class="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 class="text-lg font-semibold text-zinc-100">Built-in Channels</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  Project-linked chat rooms. AI summarizes threads and extracts action items. Context lives next to the work.
                </p>
              </div>
            </div>
          </div>

          <!-- Stakeholder Spaces -->
          <div class="intro group" style="--d: 360ms">
            <div class="relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all duration-300">
              <div class="p-8">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Icon name="heroicons:megaphone" class="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 class="text-lg font-semibold text-zinc-100">Stakeholder Spaces</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  External portals for clients and investors. Filtered views of progress, AI-translated status updates for different audiences.
                </p>
              </div>
            </div>
          </div>

          <!-- Focus Tracking -->
          <div class="intro group" style="--d: 420ms">
            <div class="relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all duration-300">
              <div class="p-8">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Icon name="heroicons:clock" class="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 class="text-lg font-semibold text-zinc-100">Focus Tracking</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  Deep work, meetings, admin, learning, break. Know where time goes. Spot burnout before it happens.
                </p>
              </div>
              <div class="px-8 pb-6">
                <div class="flex gap-1.5">
                  <div class="flex-1 h-2 rounded-full bg-emerald-500/30" title="Deep Work" />
                  <div class="w-8 h-2 rounded-full bg-amber-500/30" title="Meetings" />
                  <div class="w-4 h-2 rounded-full bg-blue-500/30" title="Admin" />
                  <div class="w-6 h-2 rounded-full bg-violet-500/30" title="Learning" />
                  <div class="w-3 h-2 rounded-full bg-zinc-500/30" title="Break" />
                </div>
                <div class="flex justify-between mt-2 text-[10px] text-zinc-600">
                  <span>Deep work</span>
                  <span>4h 32m today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ STATS ═══════════════════════ -->
    <section class="px-6 py-16">
      <div class="max-w-4xl mx-auto">
        <div class="intro grid grid-cols-2 md:grid-cols-4 gap-8 py-12 px-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]" style="--d: 0ms">
          <div class="text-center">
            <div class="text-3xl sm:text-4xl font-bold text-zinc-100">&#8734;</div>
            <div class="mt-1 text-sm text-zinc-500">Nesting Depth</div>
          </div>
          <div class="text-center">
            <div class="text-3xl sm:text-4xl font-bold text-zinc-100">100%</div>
            <div class="mt-1 text-sm text-zinc-500">Open Source</div>
          </div>
          <div class="text-center">
            <div class="text-3xl sm:text-4xl font-bold text-zinc-100">0</div>
            <div class="mt-1 text-sm text-zinc-500">Vendor Lock-in</div>
          </div>
          <div class="text-center">
            <div class="text-3xl sm:text-4xl font-bold text-emerald-400">Free</div>
            <div class="mt-1 text-sm text-zinc-500">Forever</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ COMPARISON ═══════════════════════ -->
    <section
      id="compare"
      :ref="(el) => (sectionRefs.compare = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-32 scroll-mt-20"
    >
      <div class="max-w-3xl mx-auto">
        <div class="text-center mb-12">
          <p class="intro text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4" style="--d: 0ms">Compare</p>
          <h2 class="intro text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight" style="--d: 60ms">
            Why not Linear or Jira?
          </h2>
          <p class="intro mt-4 text-zinc-400 text-lg max-w-2xl mx-auto" style="--d: 120ms">
            Great tools, built for humans only. Context is built for the team you actually have.
          </p>
        </div>

        <div class="intro rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" style="--d: 180ms">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-white/[0.06]">
                <th class="text-left px-6 py-4 text-zinc-500 font-medium">Feature</th>
                <th class="px-4 py-4 text-center">
                  <span class="text-emerald-400 font-semibold">OpenContext</span>
                </th>
                <th class="px-4 py-4 text-center text-zinc-500 font-medium">Linear</th>
                <th class="px-4 py-4 text-center text-zinc-500 font-medium">Jira</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in comparisonRows"
                :key="row.feature"
                class="border-b border-white/[0.03] last:border-0"
              >
                <td class="px-6 py-3.5 text-zinc-300">{{ row.feature }}</td>
                <td class="px-4 py-3.5 text-center">
                  <span v-if="row.context" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  </span>
                  <span v-else class="text-zinc-700">-</span>
                </td>
                <td class="px-4 py-3.5 text-center">
                  <span v-if="row.linear" class="text-zinc-500">&#10003;</span>
                  <span v-else class="text-zinc-700">-</span>
                </td>
                <td class="px-4 py-3.5 text-center">
                  <span v-if="row.jira" class="text-zinc-500">&#10003;</span>
                  <span v-else class="text-zinc-700">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ GET STARTED ═══════════════════════ -->
    <section
      id="get-started"
      :ref="(el) => (sectionRefs['get-started'] = el as HTMLElement | null)"
      class="px-6 py-24 lg:py-32 scroll-mt-20"
    >
      <div class="max-w-3xl mx-auto">
        <div class="text-center mb-12">
          <p class="intro text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4" style="--d: 0ms">Get Started</p>
          <h2 class="intro text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight" style="--d: 60ms">
            Running in 2 minutes
          </h2>
          <p class="intro mt-4 text-zinc-400 text-lg" style="--d: 120ms">
            No database setup needed. PGlite runs embedded.
          </p>
        </div>

        <div class="space-y-4">
          <div
            v-for="(step, i) in quickStartSteps"
            :key="step.num"
            class="intro"
            :style="{ '--d': `${180 + i * 60}ms` }"
          >
            <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.1] transition-all">
              <div class="flex items-start gap-5">
                <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-sm font-mono font-bold text-emerald-400">
                  {{ step.num }}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-base font-semibold text-zinc-100 mb-2">{{ step.title }}</h3>
                  <div class="rounded-lg bg-[#0c0c0e] px-4 py-3 font-mono text-sm text-zinc-400 overflow-x-auto">
                    {{ step.cmd }}
                  </div>
                  <p v-if="step.desc" class="mt-2 text-sm text-zinc-500">{{ step.desc }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ CTA ═══════════════════════ -->
    <section class="px-6 py-24 lg:py-32">
      <div class="max-w-4xl mx-auto">
        <div class="intro relative rounded-3xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-blue-500/[0.06] p-12 sm:p-16 text-center overflow-hidden" style="--d: 0ms">
          <!-- Subtle glow -->
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-emerald-500/[0.08] rounded-full blur-[80px]" />

          <h2 class="relative text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-4">
            Ready to build?
          </h2>
          <p class="relative text-zinc-400 text-lg max-w-lg mx-auto mb-8">
            Context is built in the open. Star us, open issues, submit PRs, or just come hang out.
          </p>
          <div class="relative flex flex-col sm:flex-row items-center justify-center gap-4">
            <NuxtLink
              to="/onboarding"
              class="inline-flex items-center gap-2.5 px-8 py-4 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-all shadow-lg shadow-white/[0.08] text-sm"
            >
              Get Started Free
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            </NuxtLink>
            <a
              href="https://github.com/recursion-endeavours/context"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-2 px-6 py-4 border border-white/[0.1] text-zinc-300 font-semibold rounded-xl hover:border-white/[0.2] hover:bg-white/[0.04] transition-all text-sm"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Star on GitHub
            </a>
            <a
              href="#"
              class="inline-flex items-center gap-2 px-6 py-4 border border-[#5865F2]/20 bg-[#5865F2]/[0.06] text-[#8b95f5] font-semibold rounded-xl hover:bg-[#5865F2]/[0.12] transition-all text-sm"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              Join Discord
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ FOOTER ═══════════════════════ -->
    <footer class="border-t border-white/[0.06] px-6 py-16">
      <div class="max-w-6xl mx-auto">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <!-- Brand -->
          <div class="col-span-2">
            <div class="flex items-center gap-2.5 mb-4">
              <div class="w-8 h-8 bg-white/[0.06] rounded-xl flex items-center justify-center">
                <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-[17px] tracking-tight"><span class="font-semibold text-white">open</span><span class="font-normal text-zinc-400">context</span></span>
            </div>
            <p class="text-sm text-zinc-500 leading-relaxed max-w-xs">
              Open-source project management for human-agent teams. Built in the open, free forever.
            </p>
          </div>

          <!-- Product -->
          <div>
            <h4 class="text-sm font-semibold text-zinc-300 mb-4">Product</h4>
            <ul class="space-y-2.5 text-sm text-zinc-500">
              <li><button @click="scrollToSection('features')" class="hover:text-zinc-300 transition-colors cursor-pointer">Features</button></li>
              <li><button @click="scrollToSection('compare')" class="hover:text-zinc-300 transition-colors cursor-pointer">Compare</button></li>
              <li><button @click="scrollToSection('get-started')" class="hover:text-zinc-300 transition-colors cursor-pointer">Quick Start</button></li>
            </ul>
          </div>

          <!-- Community -->
          <div>
            <h4 class="text-sm font-semibold text-zinc-300 mb-4">Community</h4>
            <ul class="space-y-2.5 text-sm text-zinc-500">
              <li><a href="https://github.com/recursion-endeavours/context" target="_blank" rel="noopener" class="hover:text-zinc-300 transition-colors">GitHub</a></li>
              <li><a href="#" class="hover:text-zinc-300 transition-colors">Discord</a></li>
              <li><a href="#" class="hover:text-zinc-300 transition-colors">X / Twitter</a></li>
            </ul>
          </div>

          <!-- Legal -->
          <div>
            <h4 class="text-sm font-semibold text-zinc-300 mb-4">Legal</h4>
            <ul class="space-y-2.5 text-sm text-zinc-500">
              <li><a href="#" class="hover:text-zinc-300 transition-colors">Privacy</a></li>
              <li><a href="#" class="hover:text-zinc-300 transition-colors">Terms</a></li>
              <li><a href="mailto:hello@recursion-endeavours.com" class="hover:text-zinc-300 transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div class="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span class="text-xs text-zinc-600">&copy; 2026 Recursion Endeavours AS &middot; BSL 1.1</span>
          <span class="text-xs text-zinc-700">Built for the age of agents.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Clip fixed-position StarField to the hero bounds */
.hero-clip {
  clip-path: inset(0);
}

.hero-gradient {
  background-image: linear-gradient(135deg, #e2e8f0 0%, #c4b5fd 50%, #93c5fd 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

/* ── Hero bottom arc — radial blobs (concave, soft fade) ── */
.hero-arc {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70vh;
  pointer-events: none;
}

.hero-arc-left {
  position: absolute;
  bottom: 0;
  left: -15%;
  width: 80%;
  height: 100%;
  background: radial-gradient(
    ellipse 90% 85% at 10% 100%,
    rgba(74, 222, 128, 0.7) 0%,
    rgba(34, 211, 238, 0.5) 18%,
    rgba(99, 102, 241, 0.28) 38%,
    rgba(167, 139, 250, 0.1) 58%,
    transparent 82%
  );
}

.hero-arc-right {
  position: absolute;
  bottom: 0;
  right: -15%;
  width: 80%;
  height: 100%;
  background: radial-gradient(
    ellipse 90% 85% at 90% 100%,
    rgba(251, 146, 60, 0.65) 0%,
    rgba(244, 114, 182, 0.5) 18%,
    rgba(167, 139, 250, 0.28) 38%,
    rgba(99, 102, 241, 0.1) 58%,
    transparent 82%
  );
}

/* Subtle center bridge — very soft, just prevents a dead zone */
.hero-arc-center {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 45%;
  background: radial-gradient(
    ellipse 50% 100% at 50% 100%,
    rgba(139, 92, 246, 0.2) 0%,
    rgba(99, 102, 241, 0.08) 40%,
    transparent 75%
  );
}

/* ── Intro animations ── */
.intro {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform;
}

.is-ready .intro {
  opacity: 1;
  transform: translateY(0);
}

/* ── Terminal ── */
.terminal-line {
  min-height: 1.4em;
  line-height: 1.5;
}

.terminal-cursor {
  color: #4ade80;
  animation: blink 0.7s step-end infinite;
  font-weight: 300;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* ── Toast transitions ── */
.toast-slide-enter-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
.toast-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
.toast-slide-move {
  transition: transform 0.4s ease;
}
</style>
