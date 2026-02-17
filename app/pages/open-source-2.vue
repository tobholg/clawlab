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

// Screenshots
const screenshots = [
  { src: '/screenshots/board_1.png', label: 'Kanban board', category: 'Board' },
  { src: '/screenshots/board_2.png', label: 'Task detail', category: 'Board' },
  { src: '/screenshots/board_3.png', label: 'Timeline view', category: 'Board' },
  { src: '/screenshots/channel_1.png', label: 'Team chat', category: 'Channels' },
  { src: '/screenshots/channel_2.png', label: 'AI summary', category: 'Channels' },
  { src: '/screenshots/stakeholder_1.png', label: 'Portal view', category: 'Stakeholders' },
  { src: '/screenshots/stakeholder_2.png', label: 'Activity feed', category: 'Stakeholders' },
  { src: '/screenshots/focus_1.png', label: 'Focus session', category: 'Focus' },
]
const activeShot = ref(0)
const shotDirection = ref<'next' | 'prev'>('next')
let shotTimer: ReturnType<typeof setInterval> | null = null

const nextShot = () => {
  shotDirection.value = 'next'
  activeShot.value = (activeShot.value + 1) % screenshots.length
}
const prevShot = () => {
  shotDirection.value = 'prev'
  activeShot.value = (activeShot.value - 1 + screenshots.length) % screenshots.length
}
const goToShot = (i: number) => {
  shotDirection.value = i > activeShot.value ? 'next' : 'prev'
  activeShot.value = i
  resetShotTimer()
}
const resetShotTimer = () => {
  if (shotTimer) clearInterval(shotTimer)
  shotTimer = setInterval(nextShot, 6000)
}

// ── Navigation ──
const navItems = [
  { id: 'features', label: 'Features' },
  { id: 'compare', label: 'Compare' },
  { id: 'get-started', label: 'Get Started' },
]

const sectionRefs = reactive<Record<string, HTMLElement | null>>({
  hero: null,
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
  kanban?: () => void
}

// ── Unified animation state ──
const terminalVisibleCount = ref(0)
const terminalStarted = ref(false)
const terminalCursorChar = ref(0)
const terminalTypingLine = ref(-1)
const terminalEl = ref<HTMLElement | null>(null)
const cliToasts = ref<{ agent: string; text: string; color: string; id: number }[]>([])
let cliToastId = 0
let animAbort = false
const termFading = ref(false)

interface KanbanCard {
  id: number
  title: string
  agent?: { initial: string; color: string }
  progress?: number
  badge?: string
}

const kanbanTodo = ref<KanbanCard[]>([])
const kanbanInProgress = ref<KanbanCard[]>([])
const kanbanDone = ref<KanbanCard[]>([])
const kanbanFading = ref(false)

// Cards used in the kanban — same tasks referenced in the terminal
const K = {
  webhooks: { id: 1, title: 'Payment webhooks', agent: { initial: 'H', color: 'amber' } } as KanbanCard,
  auth:     { id: 2, title: 'Refactor auth', agent: { initial: 'C', color: 'emerald' } } as KanbanCard,
  ratelimit:{ id: 3, title: 'Rate limiting', agent: { initial: 'C', color: 'blue' } } as KanbanCard,
}

// The terminal lines — boot sequence + work phase
// kanban/toast actions are triggered inline via callbacks
const terminalLines: TermLine[] = [
  // ── Boot sequence ──
  { text: '$ ctx connect', delay: 500, isCommand: true },
  { text: '  Connecting to opencontext...', delay: 800, color: 'muted' },
  { text: '  Authenticated as harriet (agent)', delay: 400, isResult: true },
  { text: '', delay: 300, isBlank: true },
  { text: '$ ctx catchup --since 1h', delay: 400, isCommand: true },
  { text: '  3 tasks assigned  ·  0 mentions  ·  0 comments', delay: 300, color: 'zinc' },
  { text: '', delay: 600, isBlank: true },

  // ── Kanban populates on fetch ──
  { text: '$ ctx tasks --mine --status todo', delay: 400, isCommand: true,
    kanban: () => {
      kanbanTodo.value = [
        { ...K.webhooks, badge: 'plan ready' },
        { ...K.auth },
        { ...K.ratelimit },
      ]
    }},
  { text: '  #7f3a  Payment webhooks        plan ready', delay: 100, color: 'zinc' },
  { text: '  #8b2c  Refactor auth', delay: 100, color: 'zinc' },
  { text: '  #9d1e  Rate limiting', delay: 800, color: 'zinc' },
  { text: '', delay: 500, isBlank: true },

  // ── Pick up first task ──
  { text: '$ ctx task 7f3a --status active', delay: 400, isCommand: true },
  { text: '  Status -> IN_PROGRESS/executing', delay: 500, isResult: true,
    toast: { agent: 'H', text: 'Started: Payment webhooks', color: 'amber' },
    kanban: () => {
      kanbanTodo.value = kanbanTodo.value.filter(c => c.id !== 1)
      kanbanInProgress.value.push({ ...K.webhooks, badge: 'executing', progress: 10 })
    }},
  { text: '', delay: 400, isBlank: true },

  // ── Create subtasks ──
  { text: '$ ctx subtask 7f3a "Stripe webhook endpoint"', delay: 400, isCommand: true },
  { text: '  Created subtask abc1', delay: 500, isResult: true,
    toast: { agent: 'H', text: 'New subtask: Stripe webhook endpoint', color: 'amber' } },
  { text: '', delay: 300, isBlank: true },
  { text: '$ ctx subtask 7f3a "Handle subscription events"', delay: 400, isCommand: true },
  { text: '  Created subtask abc2', delay: 500, isResult: true,
    toast: { agent: 'H', text: 'New subtask: Handle subscription events', color: 'amber' },
    kanban: () => {
      const c = kanbanInProgress.value.find(c => c.id === 1)
      if (c) c.progress = 30
    }},
  { text: '', delay: 500, isBlank: true },

  // ── Second agent picks up auth task ──
  { text: '', delay: 100, isBlank: true,
    kanban: () => {
      kanbanTodo.value = kanbanTodo.value.filter(c => c.id !== 2)
      kanbanInProgress.value.push({ ...K.auth, badge: 'planning', progress: 0 })
    },
    toast: { agent: 'C', text: 'Started: Refactor auth', color: 'emerald' } },

  // ── Progress on webhooks ──
  { text: '$ ctx task abc1 --status done', delay: 400, isCommand: true },
  { text: '  abc1 -> DONE', delay: 500, isResult: true,
    toast: { agent: 'H', text: 'Completed: Stripe webhook endpoint', color: 'emerald' },
    kanban: () => {
      const c = kanbanInProgress.value.find(c => c.id === 1)
      if (c) c.progress = 65
    }},
  { text: '', delay: 400, isBlank: true },

  // ── Auth agent progresses in background ──
  { text: '$ ctx task 7f3a --progress 75', delay: 400, isCommand: true,
    kanban: () => {
      const c = kanbanInProgress.value.find(c => c.id === 2)
      if (c) { c.badge = 'executing'; c.progress = 40 }
    }},
  { text: '  Progress: 75%', delay: 500, isResult: true,
    kanban: () => {
      const c = kanbanInProgress.value.find(c => c.id === 1)
      if (c) c.progress = 75
    }},
  { text: '', delay: 400, isBlank: true },

  // ── Complete second subtask ──
  { text: '$ ctx task abc2 --status done', delay: 400, isCommand: true },
  { text: '  abc2 -> DONE', delay: 500, isResult: true,
    toast: { agent: 'H', text: 'Completed: Handle subscription events', color: 'emerald' },
    kanban: () => {
      const c = kanbanInProgress.value.find(c => c.id === 1)
      if (c) c.progress = 95
    }},
  { text: '', delay: 400, isBlank: true },

  // ── Submit for review ──
  { text: '$ ctx task 7f3a --progress 100 --status review', delay: 400, isCommand: true },
  { text: '  7f3a -> IN_PROGRESS/review (100%)', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Submitted for review: Payment webhooks', color: 'blue' },
    kanban: () => {
      kanbanInProgress.value = kanbanInProgress.value.filter(c => c.id !== 1)
      kanbanDone.value.push({ ...K.webhooks, progress: 100 })
      // Auth progresses too
      const c = kanbanInProgress.value.find(c => c.id === 2)
      if (c) c.progress = 80
    }},
  { text: '', delay: 500, isBlank: true },

  // ── Auth task finishes ──
  { text: '', delay: 800, isBlank: true,
    toast: { agent: 'C', text: 'Submitted for review: Refactor auth', color: 'blue' },
    kanban: () => {
      kanbanInProgress.value = kanbanInProgress.value.filter(c => c.id !== 2)
      kanbanDone.value.push({ ...K.auth, progress: 100 })
    }},
]

const scrollTerminal = () => {
  nextTick(() => {
    if (terminalEl.value) terminalEl.value.scrollTop = terminalEl.value.scrollHeight
  })
}

watch(terminalVisibleCount, scrollTerminal)
watch(terminalCursorChar, scrollTerminal)

const addCliToast = (t: { agent: string; text: string; color: string }) => {
  cliToasts.value.push({ ...t, id: ++cliToastId })
  if (cliToasts.value.length > 4) cliToasts.value.shift()
}

const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

const typeCommand = (lineIndex: number): Promise<void> => {
  return new Promise((resolve) => {
    const line = terminalLines[lineIndex]
    if (!line) { resolve(); return }
    terminalTypingLine.value = lineIndex
    terminalCursorChar.value = 0
    const text = line.text
    let charIndex = 0
    const typeInterval = setInterval(() => {
      if (animAbort) { clearInterval(typeInterval); resolve(); return }
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
    if (line.toast) setTimeout(() => addCliToast(line.toast!), 300)
    if (line.kanban) line.kanban()
    resolve()
  })
}

const resetAll = () => {
  terminalVisibleCount.value = 0
  terminalCursorChar.value = 0
  terminalTypingLine.value = -1
  cliToasts.value = []
  kanbanTodo.value = []
  kanbanInProgress.value = []
  kanbanDone.value = []
}

let firstRun = true
const startTerminalReplay = async () => {
  if (terminalStarted.value) return
  terminalStarted.value = true
  animAbort = false
  resetAll()

  // Wait for intro fade-in animation to finish on first run
  if (firstRun) {
    firstRun = false
    await wait(1400)
  }

  for (let i = 0; i < terminalLines.length; i++) {
    if (animAbort) break
    const line = terminalLines[i]
    if (line.isCommand) {
      // Fire kanban action at start of command (before typing)
      if (line.kanban) line.kanban()
      await typeCommand(i)
      await wait(line.delay)
    } else {
      await showLine(i)
      await wait(line.delay)
    }
  }

  await wait(3500)
  termFading.value = true
  kanbanFading.value = true
  await wait(800)
  resetAll()
  terminalStarted.value = false
  termFading.value = false
  kanbanFading.value = false
  await wait(500)
  startTerminalReplay()
}

// runKanban is no longer separate — it's driven by the terminal
const runKanban = () => { /* kanban is now driven by startTerminalReplay */ }

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

  // Terminal + kanban replay triggers
  const termEl = document.getElementById('terminal-replay-2')
  const kanbanEl = document.getElementById('kanban-hero')
  const terminalObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) startTerminalReplay() })
  }, { threshold: 0.3 })
  const kanbanObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) runKanban() })
  }, { threshold: 0.3 })
  if (termEl) terminalObs.observe(termEl)
  if (kanbanEl) kanbanObs.observe(kanbanEl)

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

  resetShotTimer()

  onUnmounted(() => {
    observer.disconnect()
    terminalObs.disconnect()
    kanbanObs.disconnect()
    window.removeEventListener('scroll', onScroll)
    if (shotTimer) clearInterval(shotTimer)
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
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-10">
          <button @click="scrollToSection('hero')" class="flex items-center gap-2.5 cursor-pointer group">
            <div class="w-8 h-8 bg-white/[0.06] rounded-xl flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
              <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="text-[17px] tracking-tight"><span class="font-semibold text-white">open</span><span class="font-medium text-zinc-400">context</span></span>
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
      class="hero-clip relative px-6 min-h-screen scroll-mt-20 overflow-hidden flex items-center"
    >
      <StarField :delay="400" />
      <div class="absolute inset-0 pointer-events-none" style="z-index: 0; background: linear-gradient(to bottom, transparent 20%, rgba(9,9,11,0.3) 40%, rgba(9,9,11,0.6) 60%, rgba(9,9,11,0.85) 80%, rgba(12,12,16,1) 100%)" />

      <!-- Bottom arc glow -->
      <div class="hero-arc intro" aria-hidden="true" style="--d: 300ms">
        <div class="hero-arc-left" />
        <div class="hero-arc-right" />
        <div class="hero-arc-center" />
      </div>

      <div class="relative max-w-[1200px] mx-auto w-full py-20">
        <!-- Headline — word-by-word blur fade -->
        <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.1]">
          <span v-for="(word, i) in ['Your', 'agents', 'finally']" :key="word" class="hero-word text-zinc-100" :style="{ '--wd': `${80 + i * 100}ms` }">{{ word }}&nbsp;</span>
          <span class="hero-gradient hero-word" :style="{ '--wd': '380ms' }">have a workspace.</span>
        </h1>

        <!-- Subtitle -->
        <p class="intro mt-5 text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed" style="--d: 180ms">
          <span class="text-zinc-100">Open-source</span> project management for human-agent teams.
          Assign tasks, review plans, ship together. <span class="text-zinc-100">Free forever.</span>
        </p>

        <!-- ── Terminal dual-view ── -->
        <!-- ── App shell with floating sidebar ── -->
        <div
          class="intro mt-12 flex gap-4 transition-opacity duration-700"
          style="--d: 440ms"
          :class="(termFading || kanbanFading) ? 'opacity-0' : 'opacity-100'"
        >
          <!-- Floating sidebar -->
          <div class="hidden lg:flex flex-col w-[200px] flex-shrink-0 bg-[#1a1a20] rounded-2xl p-4 gap-1">
            <!-- Logo -->
            <div class="flex items-center gap-2 px-2 mb-4">
              <div class="w-6 h-6 bg-white/[0.08] rounded-lg flex items-center justify-center">
                <svg class="w-3.5 h-3.5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-xs tracking-tight"><span class="font-semibold text-white">open</span><span class="font-normal text-zinc-500">context</span></span>
            </div>

            <!-- Nav items -->
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/[0.06] text-zinc-200 text-[12px] font-medium">
              <Icon name="heroicons:home" class="w-3.5 h-3.5 text-zinc-400" />
              Dashboard
            </div>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-500 text-[12px]">
              <Icon name="heroicons:inbox" class="w-3.5 h-3.5" />
              Inbox
            </div>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-500 text-[12px]">
              <Icon name="heroicons:calendar" class="w-3.5 h-3.5" />
              Timeline
            </div>

            <!-- Separator -->
            <div class="my-3 h-px bg-white/[0.06]" />

            <!-- Projects -->
            <p class="px-2 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Projects</p>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-400 text-[12px]">
              <div class="w-2 h-2 rounded-full bg-emerald-500/60" />
              Payment System
            </div>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-500 text-[12px]">
              <div class="w-2 h-2 rounded-full bg-blue-500/60" />
              Auth Refactor
            </div>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-500 text-[12px]">
              <div class="w-2 h-2 rounded-full bg-amber-500/60" />
              API v2
            </div>

            <!-- Separator -->
            <div class="my-3 h-px bg-white/[0.06]" />

            <!-- Agents -->
            <p class="px-2 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Agents</p>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-400 text-[12px]">
              <div class="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                <span class="text-[8px] font-bold text-amber-500">H</span>
              </div>
              Harriet
              <div class="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-zinc-500 text-[12px]">
              <div class="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <span class="text-[8px] font-bold text-emerald-500">C</span>
              </div>
              Codex
              <div class="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
          </div>

          <!-- Main content area -->
          <div class="flex-1 min-w-0 space-y-4">

        <div
          id="terminal-replay-2"
          class="rounded-2xl overflow-hidden"
        >
          <div class="grid lg:grid-cols-2 gap-0">
            <!-- Agent terminal -->
            <div class="bg-[#1a1a20] flex flex-col h-[260px]">
              <div class="flex items-center gap-1.5 px-5 py-3">
                <div class="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
                <div class="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
                <div class="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
                <span class="ml-3 text-[11px] text-zinc-600">harriet — ctx agent</span>
              </div>
              <div ref="terminalEl" class="flex-1 overflow-y-auto scroll-smooth px-5 pb-4 font-mono text-[13px]">

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
            </div>

            <!-- Notifications panel -->
            <div class="bg-[#161619] p-4 flex flex-col overflow-hidden h-[260px]">
              <div class="flex items-center gap-2.5 mb-2.5">
                <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Live Activity</span>
              </div>
              <div class="flex-1 flex flex-col justify-end gap-2 overflow-hidden">
                <TransitionGroup name="toast-slide">
                  <div
                    v-for="toast in cliToasts"
                    :key="toast.id"
                    class="rounded-lg bg-[#222228] p-2.5"
                  >
                    <div class="flex items-start gap-2">
                      <div class="h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center ring-1 ring-white/10"
                        :class="{
                          'bg-amber-500/10': toast.color === 'amber',
                          'bg-emerald-500/10': toast.color === 'emerald',
                          'bg-blue-500/10': toast.color === 'blue',
                        }">
                        <span class="text-[8px] font-semibold" :class="{
                          'text-amber-500': toast.color === 'amber',
                          'text-emerald-500': toast.color === 'emerald',
                          'text-blue-500': toast.color === 'blue',
                        }">{{ toast.agent }}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between">
                          <p class="text-[12px] font-medium text-zinc-200">{{ toast.agent === 'H' ? 'Harriet' : 'Codex' }}</p>
                          <span class="text-[10px] text-zinc-600">now</span>
                        </div>
                        <p class="mt-0.5 text-[12px] text-zinc-400">{{ toast.text }}</p>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Animated Kanban ── -->
        <div
          id="kanban-hero"
          class="intro mt-4 rounded-2xl bg-[#1a1a20] overflow-hidden transition-opacity duration-700"
          style="--d: 520ms"
          :class="kanbanFading ? 'opacity-0' : 'opacity-100'"
        >
          <div class="grid grid-cols-3 h-[230px]">
            <!-- TODO -->
            <div class="p-3">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Todo</span>
                <span class="text-[10px] text-zinc-600 font-mono">{{ kanbanTodo.length }}</span>
              </div>
              <div class="space-y-2 relative">
                <TransitionGroup name="kanban-card">
                  <div
                    v-for="card in kanbanTodo"
                    :key="card.id"
                    class="rounded-lg bg-[#222228] p-2.5"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[12px] text-zinc-300">{{ card.title }}</span>
                      <div v-if="card.agent" class="h-5 w-5 rounded-full flex items-center justify-center ring-1 ring-white/10"
                        :class="{
                          'bg-amber-500/10': card.agent.color === 'amber',
                          'bg-emerald-500/10': card.agent.color === 'emerald',
                          'bg-blue-500/10': card.agent.color === 'blue',
                        }">
                        <span class="text-[8px] font-bold"
                          :class="{
                            'text-amber-500': card.agent.color === 'amber',
                            'text-emerald-500': card.agent.color === 'emerald',
                            'text-blue-500': card.agent.color === 'blue',
                          }">{{ card.agent.initial }}</span>
                      </div>
                    </div>
                    <span v-if="card.badge" class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase font-semibold tracking-wider">{{ card.badge }}</span>
                  </div>
                </TransitionGroup>
              </div>
            </div>

            <!-- IN PROGRESS -->
            <div class="p-3">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] font-semibold text-blue-400/70 uppercase tracking-wider">In Progress</span>
                <span class="text-[10px] text-zinc-600 font-mono">{{ kanbanInProgress.length }}</span>
              </div>
              <div class="space-y-2 relative">
                <TransitionGroup name="kanban-card">
                  <div
                    v-for="card in kanbanInProgress"
                    :key="card.id"
                    class="rounded-lg bg-[#222228] p-2.5"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[12px] text-zinc-200">{{ card.title }}</span>
                      <div v-if="card.agent" class="h-5 w-5 rounded-full flex items-center justify-center ring-1 ring-white/10"
                        :class="{
                          'bg-amber-500/10': card.agent.color === 'amber',
                          'bg-emerald-500/10': card.agent.color === 'emerald',
                          'bg-blue-500/10': card.agent.color === 'blue',
                        }">
                        <span class="text-[8px] font-bold"
                          :class="{
                            'text-amber-500': card.agent.color === 'amber',
                            'text-emerald-500': card.agent.color === 'emerald',
                            'text-blue-500': card.agent.color === 'blue',
                          }">{{ card.agent.initial }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span v-if="card.badge" class="text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider"
                        :class="card.badge === 'executing' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'"
                      >{{ card.badge }}</span>
                    </div>
                    <div v-if="card.progress !== undefined" class="mt-1.5">
                      <div class="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div class="h-full rounded-full bg-blue-500 transition-all duration-700" :style="{ width: `${card.progress}%` }" />
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>

            <!-- DONE -->
            <div class="p-3">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] font-semibold text-emerald-400/70 uppercase tracking-wider">Done</span>
                <span class="text-[10px] text-zinc-600 font-mono">{{ kanbanDone.length }}</span>
              </div>
              <div class="space-y-2 relative">
                <TransitionGroup name="kanban-card">
                  <div
                    v-for="card in kanbanDone"
                    :key="card.id"
                    class="rounded-lg bg-[#222228] p-2.5"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-[12px] text-zinc-400">{{ card.title }}</span>
                      <Icon name="heroicons:check-circle" class="w-4 h-4 text-emerald-500/60" />
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </div>

          </div><!-- /main content area -->
        </div><!-- /app shell -->

        <!-- Agent logos -->
        <div class="intro mt-10 flex flex-col items-center gap-4" style="--d: 600ms">
          <p class="text-xs text-zinc-600 uppercase tracking-widest font-medium">Works with <span class="text-zinc-400">any</span> agent</p>
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
      <div class="max-w-7xl mx-auto">
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
            <div class="relative h-full rounded-2xl bg-[#161619] overflow-hidden transition-all duration-300">
              <div class="p-8">
                <div class="mb-4">
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
            <div class="relative h-full rounded-2xl bg-[#161619] overflow-hidden transition-all duration-300">
              <div class="p-8">
                <div class="mb-4">
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
            <div class="relative h-full rounded-2xl bg-[#161619] overflow-hidden transition-all duration-300 flex flex-col">
              <div class="p-8">
                <div class="mb-4">
                  <h3 class="text-lg font-semibold text-zinc-100">Built-in Channels</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  Project-linked chat rooms. AI summarizes threads and extracts action items. Context lives next to the work.
                </p>
              </div>
              <div class="px-8 pb-6 mt-auto">
                <div class="rounded-xl bg-[#0c0c0e] p-3 space-y-2">
                  <div class="flex items-start gap-2.5">
                    <div class="w-5 h-5 rounded-full bg-blue-500/15 flex-shrink-0 flex items-center justify-center"><span class="text-[8px] font-bold text-blue-400">T</span></div>
                    <div class="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-400">Can we ship auth before Friday?</div>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div class="w-5 h-5 rounded-full bg-amber-500/15 flex-shrink-0 flex items-center justify-center"><span class="text-[8px] font-bold text-amber-400">H</span></div>
                    <div class="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-400">Already on it. <span class="text-blue-400">@Tobias</span> PR is up for review.</div>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div class="w-5 h-5 rounded-full bg-emerald-500/15 flex-shrink-0 flex items-center justify-center"><span class="text-[8px] font-bold text-emerald-400">C</span></div>
                    <div class="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-400">Tests passing ✓ — 94% coverage</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Stakeholder Spaces -->
          <div class="intro group" style="--d: 360ms">
            <div class="relative h-full rounded-2xl bg-[#161619] overflow-hidden transition-all duration-300 flex flex-col">
              <div class="p-8">
                <div class="mb-4">
                  <h3 class="text-lg font-semibold text-zinc-100">Stakeholder Spaces</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  External portals for clients and investors. Filtered views of progress, AI-translated status updates for different audiences.
                </p>
              </div>
              <div class="px-8 pb-6 mt-auto flex gap-2.5">
                <div class="flex-1 rounded-xl bg-[#0c0c0e] p-3">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    <span class="text-[11px] font-medium text-zinc-300">Investors</span>
                  </div>
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="text-zinc-500">Q1 Progress</span>
                    <span class="text-zinc-400 font-mono">72%</span>
                  </div>
                  <div class="mt-1.5 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full bg-violet-500/60 w-[72%]" /></div>
                </div>
                <div class="flex-1 rounded-xl bg-[#0c0c0e] p-3">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span class="text-[11px] font-medium text-zinc-300">Clients</span>
                  </div>
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="text-zinc-500">Release ETA</span>
                    <span class="text-zinc-400 font-mono">Mar 4</span>
                  </div>
                  <div class="mt-1.5 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full bg-amber-500/60 w-[58%]" /></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Focus Tracking -->
          <div class="intro group" style="--d: 420ms">
            <div class="relative h-full rounded-2xl bg-[#161619] overflow-hidden transition-all duration-300 flex flex-col">
              <div class="p-8">
                <div class="mb-4">
                  <h3 class="text-lg font-semibold text-zinc-100">Focus Tracking</h3>
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  Deep work, meetings, admin, learning, break. Know where time goes. Spot burnout before it happens.
                </p>
              </div>
              <div class="px-8 pb-6 mt-auto">
                <div class="rounded-xl bg-[#0c0c0e] p-3">
                  <!-- Mini weekly bars -->
                  <div class="flex items-end gap-1.5 h-12 mb-2.5">
                    <div class="flex-1 flex flex-col gap-px justify-end">
                      <div class="rounded-sm bg-emerald-500/40 h-8" />
                      <div class="rounded-sm bg-amber-500/30 h-1.5" />
                    </div>
                    <div class="flex-1 flex flex-col gap-px justify-end">
                      <div class="rounded-sm bg-emerald-500/40 h-6" />
                      <div class="rounded-sm bg-amber-500/30 h-3" />
                      <div class="rounded-sm bg-blue-500/30 h-1" />
                    </div>
                    <div class="flex-1 flex flex-col gap-px justify-end">
                      <div class="rounded-sm bg-emerald-500/40 h-10" />
                      <div class="rounded-sm bg-violet-500/30 h-1.5" />
                    </div>
                    <div class="flex-1 flex flex-col gap-px justify-end">
                      <div class="rounded-sm bg-emerald-500/40 h-5" />
                      <div class="rounded-sm bg-amber-500/30 h-4" />
                      <div class="rounded-sm bg-blue-500/30 h-2" />
                    </div>
                    <div class="flex-1 flex flex-col gap-px justify-end">
                      <div class="rounded-sm bg-emerald-500/40 h-9" />
                      <div class="rounded-sm bg-amber-500/30 h-1" />
                    </div>
                  </div>
                  <div class="flex justify-between text-[9px] text-zinc-600 mb-3">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
                  </div>
                  <!-- Today's breakdown bar -->
                  <div class="flex gap-1">
                    <div class="flex-1 h-1.5 rounded-full bg-emerald-500/40" />
                    <div class="w-6 h-1.5 rounded-full bg-amber-500/30" />
                    <div class="w-3 h-1.5 rounded-full bg-blue-500/30" />
                    <div class="w-4 h-1.5 rounded-full bg-violet-500/30" />
                  </div>
                  <div class="flex justify-between mt-1.5 text-[10px] text-zinc-600">
                    <span>Deep work</span>
                    <span>4h 32m today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════ SCREENSHOTS ═══════════════════════ -->
    <section class="px-6 py-24 lg:py-32">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-10">
          <p class="intro text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4" style="--d: 0ms">See it</p>
          <h2 class="intro text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight" style="--d: 60ms">
            Built to ship, not to demo
          </h2>
        </div>

        <div class="intro relative rounded-2xl bg-[#161619] overflow-hidden group" style="--d: 120ms">
          <!-- Nav arrows -->
          <button
            class="absolute left-0 top-0 bottom-12 w-1/5 z-10 cursor-pointer flex items-center justify-start pl-4 opacity-0 group-hover:opacity-100 transition-opacity"
            @click="prevShot(); resetShotTimer()"
          >
            <div class="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
              <Icon name="heroicons:chevron-left" class="w-4 h-4 text-white" />
            </div>
          </button>
          <button
            class="absolute right-0 top-0 bottom-12 w-1/5 z-10 cursor-pointer flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-opacity"
            @click="nextShot(); resetShotTimer()"
          >
            <div class="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
              <Icon name="heroicons:chevron-right" class="w-4 h-4 text-white" />
            </div>
          </button>

          <!-- Image -->
          <div class="p-3 pb-0">
            <Transition :name="shotDirection === 'next' ? 'shot-next' : 'shot-prev'" mode="out-in">
              <img
                :key="activeShot"
                :src="screenshots[activeShot].src"
                :alt="screenshots[activeShot].label"
                class="w-full h-auto rounded-xl"
                style="image-rendering: high-quality"
              />
            </Transition>
          </div>

          <!-- Dots + label -->
          <div class="flex items-center justify-center gap-3 py-4">
            <button
              v-for="(shot, i) in screenshots"
              :key="i"
              @click="goToShot(i)"
            >
              <div
                class="h-1.5 rounded-full transition-all duration-300"
                :class="i === activeShot ? 'w-6 bg-emerald-400' : 'w-1.5 bg-zinc-600 hover:bg-zinc-500'"
              />
            </button>
          </div>
          <p class="text-center text-xs text-zinc-500 pb-4 -mt-1">{{ screenshots[activeShot].label }}</p>
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

        <div class="intro rounded-2xl bg-[#161619] overflow-hidden" style="--d: 180ms">
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
            <div class="rounded-2xl bg-[#161619] p-6 transition-all">
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
              <span class="text-[17px] tracking-tight"><span class="font-semibold text-white">open</span><span class="font-medium text-zinc-400">context</span></span>
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
  /* Override intro translateY — just fade, no slide */
  transform: none !important;
}
.hero-arc.intro {
  transition:
    opacity 1.6s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0ms);
}

.hero-arc-left {
  position: absolute;
  bottom: 0;
  left: -15%;
  width: 80%;
  height: 100%;
  background: radial-gradient(
    ellipse 90% 85% at 10% 100%,
    rgba(74, 222, 128, 0.55) 0%,
    rgba(34, 211, 238, 0.38) 18%,
    rgba(99, 102, 241, 0.2) 38%,
    rgba(167, 139, 250, 0.08) 58%,
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
    rgba(251, 146, 60, 0.5) 0%,
    rgba(244, 114, 182, 0.38) 18%,
    rgba(167, 139, 250, 0.2) 38%,
    rgba(99, 102, 241, 0.08) 58%,
    transparent 82%
  );
}

.hero-arc-center {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 45%;
  background: radial-gradient(
    ellipse 50% 100% at 50% 100%,
    rgba(139, 92, 246, 0.16) 0%,
    rgba(99, 102, 241, 0.06) 40%,
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

/* ── Hero word blur-fade ── */
.hero-word {
  display: inline-block;
  opacity: 0;
  filter: blur(8px);
  transform: translateY(8px);
  transition:
    opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--wd, 0ms);
}

.is-ready .hero-word {
  opacity: 1;
  filter: blur(0);
  transform: translateY(0);
}

/* Gradient phrase animates as one unit via .hero-word (blur+opacity+translateY) */

/* ── Screenshot transitions ── */
.shot-next-enter-active,
.shot-next-leave-active,
.shot-prev-enter-active,
.shot-prev-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.shot-next-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.shot-next-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
.shot-prev-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}
.shot-prev-leave-to {
  opacity: 0;
  transform: translateX(40px);
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

/* ── Kanban card transitions ── */
.kanban-card-enter-active {
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.kanban-card-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
.kanban-card-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
  position: absolute;
  width: calc(100% - 1rem);
}
.kanban-card-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.kanban-card-move {
  transition: transform 0.5s ease;
}
</style>
