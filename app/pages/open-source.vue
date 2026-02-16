<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  title: 'Context — Project Management Where AI Agents Are Real Teammates',
  meta: [
    { name: 'description', content: 'The first open-source project manager built for human-agent teams. Assign tasks to AI agents, review their plans, track their work. Self-hosted, recursive task model, no vendor lock-in.' },
  ],
  bodyAttrs: { style: 'background-color: #050506' },
})

const navItems = [
  { id: 'agents', label: 'Agents' },
  { id: 'features', label: 'Features' },
  { id: 'compare', label: 'Compare' },
  { id: 'quickstart', label: 'Quick Start' },
]

// Flattened carousel: each slide is one screenshot tied to a feature
const featureSlides = [
  { feature: 'Recursive everything', icon: 'heroicons:queue-list', desc: 'Projects contain tasks contain subtasks, infinitely deep. Progress, confidence, and estimates bubble up automatically.', screenshot: '/screenshots/board_1.png', label: 'Kanban board' },
  { feature: 'Recursive everything', icon: 'heroicons:queue-list', desc: 'Projects contain tasks contain subtasks, infinitely deep. Progress, confidence, and estimates bubble up automatically.', screenshot: '/screenshots/board_2.png', label: 'Task detail' },
  { feature: 'Recursive everything', icon: 'heroicons:queue-list', desc: 'Projects contain tasks contain subtasks, infinitely deep. Progress, confidence, and estimates bubble up automatically.', screenshot: '/screenshots/board_3.png', label: 'Timeline view' },
  { feature: 'Built-in channels', icon: 'heroicons:chat-bubble-left-right', desc: 'Project-linked chat. AI summarizes threads, extracts action items. Context lives next to the work, not in a separate app.', screenshot: '/screenshots/channel_1.png', label: 'Team chat' },
  { feature: 'Built-in channels', icon: 'heroicons:chat-bubble-left-right', desc: 'Project-linked chat. AI summarizes threads, extracts action items. Context lives next to the work, not in a separate app.', screenshot: '/screenshots/channel_2.png', label: 'AI summary' },
  { feature: 'Stakeholder spaces', icon: 'heroicons:megaphone', desc: 'External portals for clients and investors. Filtered views of your progress. AI translates status for different audiences.', screenshot: '/screenshots/stakeholder_1.png', label: 'Portal view' },
  { feature: 'Stakeholder spaces', icon: 'heroicons:megaphone', desc: 'External portals for clients and investors. Filtered views of your progress. AI translates status for different audiences.', screenshot: '/screenshots/stakeholder_2.png', label: 'Activity feed' },
  { feature: 'Focus tracking', icon: 'heroicons:clock', desc: 'Deep work, meetings, admin, learning, break. Know where time goes. Spot burnout before it happens.', screenshot: '/screenshots/focus_1.png', label: 'Focus session' },
]

const activeSlide = ref(0)
const slideDirection = ref<'next' | 'prev'>('next')

const currentSlide = computed(() => featureSlides[activeSlide.value])

const goToSlide = (index: number) => {
  slideDirection.value = index > activeSlide.value ? 'next' : 'prev'
  activeSlide.value = index
}

const nextSlide = () => {
  slideDirection.value = 'next'
  activeSlide.value = (activeSlide.value + 1) % featureSlides.length
}

const prevSlide = () => {
  slideDirection.value = 'prev'
  activeSlide.value = (activeSlide.value - 1 + featureSlides.length) % featureSlides.length
}

// Group slides by feature for dot indicators
const featureGroups = computed(() => {
  const groups: { name: string; startIndex: number; count: number }[] = []
  let current = ''
  for (let i = 0; i < featureSlides.length; i++) {
    if (featureSlides[i].feature !== current) {
      current = featureSlides[i].feature
      groups.push({ name: current, startIndex: i, count: 1 })
    } else {
      groups[groups.length - 1].count++
    }
  }
  return groups
})

const quickStartSteps = [
  { num: '01', title: 'Clone it', cmd: 'git clone https://github.com/recursion-endeavours/context.git && cd context && npm install', desc: '' },
  { num: '02', title: 'Configure', cmd: 'cp .env.example .env', desc: 'Set a JWT secret. PGlite runs embedded by default, no database setup needed.' },
  { num: '03', title: 'Run it', cmd: 'npm run dev', desc: 'Open localhost:3000. Create a workspace. Assign your first agent.' },
]

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

const sectionRefs = reactive<Record<string, HTMLElement | null>>({
  hero: null,
  agents: null,
  features: null,
  compare: null,
  quickstart: null,
})

const activeSection = ref('hero')
const ready = ref(false)
const scrolled = ref(false)
const copied = ref(false)

// Screenshot modal
const lightbox = ref<{ featureIndex: number; rect: DOMRect; offsetX: number; offsetY: number; scale: number } | null>(null)
const lightboxOpen = ref(false)

// ── Terminal replay (agent POV) + synced toasts ──
interface TermLine {
  text: string
  delay: number
  isCommand?: boolean
  isResult?: boolean
  isBlank?: boolean
  color?: string
  toast?: { agent: string; text: string; color: string }
}

// Each line: command (typed char by char), then pauseAfter ms before next line
// Non-commands appear instantly after the previous line's pause
const terminalLines: TermLine[] = [
  { text: '$ ctx task 7f3a --get', delay: 400, isCommand: true },
  { text: '  Implement payment webhooks', delay: 100, color: 'zinc' },
  { text: '  Status: TODO  Mode: PLAN  Assigned: harriet', delay: 600, color: 'muted' },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx docs 7f3a --create "Implementation Plan"', delay: 400, isCommand: true },
  { text: '✓ Created doc d1 on task 7f3a', delay: 600, isResult: true },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task 7f3a --status active', delay: 400, isCommand: true },
  { text: '✓ Status → IN_PROGRESS/scoping', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Status changed: TODO → In Progress (scoping)', color: 'amber' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx subtask 7f3a "Set up Stripe webhook endpoint"', delay: 400, isCommand: true },
  { text: '✓ Created subtask abc1', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Created subtask: Set up Stripe webhook endpoint', color: 'amber' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx subtask 7f3a "Handle subscription events"', delay: 400, isCommand: true },
  { text: '✓ Created subtask abc2', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Created subtask: Handle subscription events', color: 'amber' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task abc1 --status done', delay: 400, isCommand: true },
  { text: '✓ abc1 → IN_PROGRESS/review', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Subtask completed: Set up Stripe webhook endpoint', color: 'emerald' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task 7f3a --progress 75', delay: 400, isCommand: true },
  { text: '✓ Progress updated: 0% → 75%', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Progress updated: 0% → 75%', color: 'emerald' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task abc2 --status done', delay: 400, isCommand: true },
  { text: '✓ abc2 → IN_PROGRESS/review', delay: 600, isResult: true,
    toast: { agent: 'H', text: 'Subtask completed: Handle subscription events', color: 'emerald' } },
  { text: '', delay: 400, isBlank: true },
  { text: '$ ctx task 7f3a --progress 100 --status done', delay: 400, isCommand: true },
  { text: '✓ 7f3a → IN_PROGRESS/review (100%)', delay: 800, isResult: true,
    toast: { agent: 'H', text: 'Submitted for review — all subtasks complete ✓', color: 'blue' } },
]

const terminalVisibleCount = ref(0)
const terminalStarted = ref(false)
const terminalCursorChar = ref(0)
const terminalTypingLine = ref(-1)
const terminalEl = ref<HTMLElement | null>(null)
const cliToasts = ref<{ agent: string; text: string; color: string; id: number }[]>([])
let cliToastId = 0
let terminalAbort = false

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

// Type a command char by char, returns a promise that resolves when done
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

// Show an output line instantly, returns a promise
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
      // Pause after command finishes typing before showing result
      await wait(line.delay)
    } else {
      await showLine(i)
      // Pause after output before next line
      await wait(line.delay)
    }
  }

  // Hold the final state for a moment
  await wait(3000)

  // Fade out, reset, fade in
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

const termFading = ref(false)

// ── Animated Kanban ──
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
const kanbanStarted = ref(false)

const allCards: KanbanCard[] = [
  { id: 1, title: 'Payment webhooks', agent: { initial: 'H', color: 'amber' }, badge: 'plan ready' },
  { id: 2, title: 'Refactor auth', agent: { initial: 'C', color: 'emerald' } },
  { id: 3, title: 'Rate limiting', agent: { initial: 'C', color: 'blue' } },
  { id: 4, title: 'User onboarding', agent: { initial: 'H', color: 'amber' } },
  { id: 5, title: 'API docs' },
  { id: 6, title: 'E2E tests' },
]

const runKanban = () => {
  if (kanbanStarted.value) return
  kanbanStarted.value = true
  kanbanFading.value = false

  // Initial state
  kanbanTodo.value = [allCards[0], allCards[1], allCards[2], allCards[3]]
  kanbanInProgress.value = []
  kanbanDone.value = []

  const moves = [
    // [delay, fromCol, cardId, toCol, updates]
    { delay: 2000, action: () => {
      kanbanTodo.value = kanbanTodo.value.filter(c => c.id !== 1)
      kanbanInProgress.value.push({ ...allCards[0], badge: 'executing', progress: 10 })
    }},
    { delay: 4500, action: () => {
      const c = kanbanInProgress.value.find(c => c.id === 1)
      if (c) c.progress = 40
    }},
    { delay: 6000, action: () => {
      kanbanTodo.value = kanbanTodo.value.filter(c => c.id !== 2)
      kanbanInProgress.value.push({ ...allCards[1], badge: 'planning', progress: 0 })
    }},
    { delay: 8000, action: () => {
      const c = kanbanInProgress.value.find(c => c.id === 1)
      if (c) c.progress = 75
    }},
    { delay: 10000, action: () => {
      const c = kanbanInProgress.value.find(c => c.id === 2)
      if (c) { c.badge = 'executing'; c.progress = 20 }
    }},
    { delay: 12000, action: () => {
      kanbanInProgress.value = kanbanInProgress.value.filter(c => c.id !== 1)
      kanbanDone.value.push({ ...allCards[0], badge: undefined, progress: 100 })
    }},
    { delay: 14000, action: () => {
      kanbanTodo.value = kanbanTodo.value.filter(c => c.id !== 3)
      kanbanInProgress.value.push({ ...allCards[2], badge: 'planning', progress: 0 })
    }},
    { delay: 16000, action: () => {
      const c = kanbanInProgress.value.find(c => c.id === 2)
      if (c) c.progress = 80
    }},
    { delay: 18000, action: () => {
      const c = kanbanInProgress.value.find(c => c.id === 3)
      if (c) { c.badge = 'executing'; c.progress = 30 }
    }},
    { delay: 20000, action: () => {
      kanbanInProgress.value = kanbanInProgress.value.filter(c => c.id !== 2)
      kanbanDone.value.push({ ...allCards[1], badge: undefined, progress: 100 })
    }},
    { delay: 22500, action: () => {
      const c = kanbanInProgress.value.find(c => c.id === 3)
      if (c) c.progress = 90
    }},
    { delay: 24500, action: () => {
      kanbanInProgress.value = kanbanInProgress.value.filter(c => c.id !== 3)
      kanbanDone.value.push({ ...allCards[2], badge: undefined, progress: 100 })
    }},
  ]

  moves.forEach(({ delay, action }) => {
    setTimeout(action, delay)
  })

  // Fade out, reset, restart
  setTimeout(() => {
    kanbanFading.value = true
    setTimeout(() => {
      kanbanTodo.value = []
      kanbanInProgress.value = []
      kanbanDone.value = []
      kanbanStarted.value = false
      kanbanFading.value = false
      runKanban()
    }, 800)
  }, 28000)
}

// (before/after slider removed)
const lightboxImageIndex = ref(0)

const closeLightbox = () => {
  lightboxOpen.value = false
  setTimeout(() => {
    lightbox.value = null
  }, 350)
}

const openCarouselLightbox = (event: Event) => {
  const el = (event.currentTarget as HTMLElement)
  const rect = el.getBoundingClientRect()
  const viewW = window.innerWidth
  const viewH = window.innerHeight
  const targetW = Math.min(viewW * 0.95, 1600)
  const scaleX = rect.width / targetW
  const offsetX = (rect.left + rect.width / 2) - viewW / 2
  const offsetY = (rect.top + rect.height / 2) - viewH / 2
  lightboxImageIndex.value = activeSlide.value
  lightbox.value = { featureIndex: 0, rect, offsetX, offsetY, scale: scaleX }
  requestAnimationFrame(() => { lightboxOpen.value = true })
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

  const onScroll = () => { scrolled.value = window.scrollY > 64 }
  window.addEventListener('scroll', onScroll, { passive: true })

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextSlide()
    else if (e.key === 'ArrowLeft') prevSlide()
  }
  window.addEventListener('keydown', onKeydown)

  // Terminal replay + simulation triggers via intersection observer
  const termEl = document.getElementById('terminal-replay')
  const kanbanEl = document.getElementById('kanban-demo')
  const terminalObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) startTerminalReplay()
    })
  }, { threshold: 0.3 })
  const kanbanObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) runKanban()
    })
  }, { threshold: 0.3 })
  if (termEl) terminalObs.observe(termEl)
  if (kanbanEl) kanbanObs.observe(kanbanEl)

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
    kanbanObs.disconnect()
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('keydown', onKeydown)
    // (slider listeners removed)
  })
})
</script>

<template>
  <div class="os-landing min-h-screen text-zinc-100 scroll-smooth" :class="{ 'is-ready': ready }">
    <div class="fixed inset-0 -z-10 bg-[#050506]" aria-hidden="true">
      <div class="absolute inset-x-0 bottom-0 h-[50vh] bg-gradient-to-t from-[#0a1628]/30 via-[#07101e]/15 to-transparent" />
      <div class="absolute inset-x-0 bottom-0 h-[20vh] bg-gradient-to-t from-[#0d1f3c]/18 to-transparent" />
    </div>
    <StarField />

    <!-- Nav -->
    <nav
      class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b transition-all duration-500 ease-out"
      :class="scrolled ? 'bg-[#050506]/80 border-white/[0.06] opacity-100 translate-y-0' : 'bg-transparent border-transparent opacity-0 -translate-y-3 pointer-events-none'"
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
      class="hero-dark relative flex flex-col items-center justify-center px-6 pt-16 sm:pt-20 lg:pt-28 pb-12 sm:pb-16 min-h-0 overflow-hidden scroll-mt-20"
    >
      <div class="relative max-w-4xl mx-auto text-center">
        <!-- Logo -->
        <div class="intro flex justify-center mb-6 sm:mb-8" style="--d: 30ms">
          <div class="w-16 h-16 sm:w-24 sm:h-24 bg-white/[0.06] rounded-xl sm:rounded-3xl flex items-center justify-center">
            <svg class="w-9 h-9 sm:w-14 sm:h-14" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <h1 class="text-3xl font-semibold sm:text-5xl sm:font-medium md:text-6xl lg:text-7xl tracking-tight leading-[1.1]">
          <span class="word-animate text-zinc-100" style="--d: 55ms">Your</span>
          <span class="word-animate text-zinc-100" style="--d: 110ms">AI</span>
          <span class="word-animate text-zinc-100" style="--d: 165ms">agents</span>
          <br />
          <span class="accent-line intro" style="--d: 240ms">need a project manager.</span>
        </h1>

        <p class="mt-4 text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed intro" style="--d: 380ms">
          The first open-source PM where AI agents are real teammates. Assign tasks, review plans, track work. Self-hosted, recursive task model, free forever.
        </p>

        <!-- CLI quick-start -->
        <div class="mt-6 flex justify-center intro" style="--d: 440ms">
          <div class="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-lg border border-white/[0.08] bg-[#111113] font-mono text-xs sm:text-sm">
            <span class="text-zinc-500 select-none">$</span>
            <span class="text-zinc-300">npx create-context-app@latest</span>
            <button
              type="button"
              class="ml-2 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              @click="copyCommand"
            >
              <Icon :name="copied ? 'heroicons:check' : 'heroicons:clipboard'" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- CTAs -->
        <div class="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 intro" style="--d: 500ms">
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

    <!-- Agent Teammates (expanded) -->
    <section
      id="agents"
      :ref="(el) => (sectionRefs.agents = el as HTMLElement | null)"
      class="px-6 py-14 lg:py-20 scroll-mt-20"
    >
      <div class="max-w-6xl mx-auto">
        <div class="text-center intro" style="--d: 520ms">
          <div class="flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-3">
            <Icon name="heroicons:cpu-chip" class="w-4 h-4" />
            Agent Teammates
          </div>
          <h2 class="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Not a chatbot sidebar.<br class="hidden sm:inline" /> A full team member.</h2>
          <p class="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Agents in Context aren't assistants that answer questions. They're teammates with assigned tasks, plans you review, subtasks they create, and progress you track. Same board, same workflow, different species.
          </p>
        </div>

        <!-- CLI (agent POV) + synced live activity -->
        <div class="mt-12 intro" style="--d: 640ms">
          <div class="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">
            <Icon name="heroicons:command-line" class="w-4 h-4" />
            Under the hood
          </div>
          <p class="text-sm text-zinc-400 mb-6 max-w-2xl">
            Left: what the agent runs. Right: what you see. Same task, two perspectives.
          </p>
          <div
            class="grid lg:grid-cols-2 gap-0 rounded-2xl border border-white/[0.06] overflow-hidden transition-opacity duration-700"
            :class="termFading ? 'opacity-0' : 'opacity-100'"
          >
            <!-- Left: agent terminal -->
            <div id="terminal-replay" ref="terminalEl" class="bg-[#0c0c0f] p-5 font-mono text-[13px] border-r border-white/[0.06] overflow-y-auto scroll-smooth h-[400px]">
              <!-- Terminal window dots -->
              <div class="flex items-center gap-1.5 mb-4">
                <div class="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
                <div class="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
                <div class="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
                <span class="ml-3 text-[11px] text-zinc-600">harriet — ctx</span>
              </div>

              <template v-for="(line, i) in terminalLines" :key="i">
                <!-- Typing state for commands -->
                <div
                  v-if="terminalTypingLine === i"
                  class="terminal-line"
                >
                  <span class="text-zinc-300">{{ line.text.slice(0, terminalCursorChar) }}</span>
                  <span class="terminal-cursor">▊</span>
                </div>
                <!-- Fully visible lines -->
                <div
                  v-else-if="i < terminalVisibleCount"
                  class="terminal-line"
                >
                  <template v-if="line.isCommand">
                    <span class="text-zinc-300">{{ line.text }}</span>
                  </template>
                  <template v-else-if="line.isBlank">
                    <div class="h-2" />
                  </template>
                  <template v-else-if="line.isResult">
                    <span class="text-emerald-400">✓</span>
                    <span class="text-zinc-400"> {{ line.text.replace('✓ ', '') }}</span>
                  </template>
                  <template v-else-if="line.color === 'muted'">
                    <span class="text-zinc-500 text-[11px]">{{ line.text }}</span>
                  </template>
                  <template v-else>
                    <span class="text-zinc-400">{{ line.text }}</span>
                  </template>
                </div>
              </template>
            </div>

            <!-- Right: live activity toasts (synced) -->
            <div class="bg-[#0a0a0d] p-5 flex flex-col overflow-hidden h-[400px]">
              <div class="flex items-center gap-2 mb-4">
                <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your notifications</span>
              </div>
              <div class="flex-1 flex flex-col justify-end gap-2.5 overflow-hidden">
                <TransitionGroup name="toast-slide">
                  <div
                    v-for="toast in cliToasts"
                    :key="toast.id"
                    class="rounded-lg border border-white/[0.08] bg-[#161619] p-3"
                  >
                    <div class="flex items-start gap-2.5">
                      <div class="h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center ring-1 ring-white/10"
                        :class="{
                          'bg-amber-500/10': toast.color === 'amber',
                          'bg-emerald-500/10': toast.color === 'emerald',
                          'bg-blue-500/10': toast.color === 'blue',
                        }"
                      >
                        <span class="text-[10px] font-semibold" :class="{
                          'text-amber-500': toast.color === 'amber',
                          'text-emerald-500': toast.color === 'emerald',
                          'text-blue-500': toast.color === 'blue',
                        }">{{ toast.agent }}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between">
                          <p class="text-sm font-semibold text-zinc-100">Harriet</p>
                          <span class="text-[10px] text-zinc-600">Just now</span>
                        </div>
                        <p class="mt-0.5 text-[11px] text-zinc-400">Payment System &gt; Implement webhooks</p>
                        <p class="mt-1 text-sm text-zinc-200">{{ toast.text }}</p>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </div>

        <!-- Animated Kanban -->
        <div id="kanban-demo" class="mt-12 intro" style="--d: 700ms">
          <div
            class="rounded-2xl border border-white/[0.06] bg-[#0c0c0f]/95 backdrop-blur-xl overflow-hidden transition-opacity duration-700"
            :class="kanbanFading ? 'opacity-0' : 'opacity-100'"
          >
            <!-- Board header -->
            <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div class="flex items-center gap-2.5">
                <Icon name="heroicons:view-columns" class="w-4 h-4 text-zinc-500" />
                <span class="text-sm font-medium text-zinc-300">Sprint 14</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span class="text-[10px] text-zinc-500">3 agents working</span>
              </div>
            </div>

            <!-- Columns -->
            <div class="grid grid-cols-3 h-[320px]">
              <!-- TODO -->
              <div class="p-3 border-r border-white/[0.06]">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Todo</span>
                  <span class="text-[10px] text-zinc-600 font-mono">{{ kanbanTodo.length }}</span>
                </div>
                <div class="space-y-2 relative">
                  <TransitionGroup name="kanban-card">
                    <div
                      v-for="card in kanbanTodo"
                      :key="card.id"
                      class="rounded-lg border border-white/[0.06] bg-[#111113] p-3"
                    >
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[13px] text-zinc-300">{{ card.title }}</span>
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
              <div class="p-3 border-r border-white/[0.06]">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[11px] font-semibold text-blue-400/70 uppercase tracking-wider">In Progress</span>
                  <span class="text-[10px] text-zinc-600 font-mono">{{ kanbanInProgress.length }}</span>
                </div>
                <div class="space-y-2 relative">
                  <TransitionGroup name="kanban-card">
                    <div
                      v-for="card in kanbanInProgress"
                      :key="card.id"
                      class="rounded-lg border border-white/[0.06] bg-[#111113] p-3"
                    >
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[13px] text-zinc-200">{{ card.title }}</span>
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
                      <div v-if="card.progress !== undefined" class="mt-2">
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
                      class="rounded-lg border border-emerald-500/10 bg-[#111113] p-3"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-[13px] text-zinc-400">{{ card.title }}</span>
                        <Icon name="heroicons:check-circle" class="w-4 h-4 text-emerald-500/60" />
                      </div>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Supported agents -->
        <div class="mt-12 text-center intro" style="--d: 760ms">
          <p class="text-sm text-zinc-500 mb-4">Works with any agent that can call an API</p>
          <div class="flex items-center justify-center gap-6 flex-wrap">
            <div class="flex items-center gap-2 text-sm text-zinc-400">
              <div class="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center"><span class="text-xs font-bold text-amber-400">O</span></div>
              OpenClaw
            </div>
            <div class="flex items-center gap-2 text-sm text-zinc-400">
              <div class="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center"><span class="text-xs font-bold text-emerald-400">C</span></div>
              Codex
            </div>
            <div class="flex items-center gap-2 text-sm text-zinc-400">
              <div class="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><span class="text-xs font-bold text-blue-400">C</span></div>
              Claude Code
            </div>
            <div class="flex items-center gap-2 text-sm text-zinc-400">
              <div class="w-7 h-7 rounded-lg bg-zinc-500/10 flex items-center justify-center"><span class="text-xs font-bold text-zinc-400">?</span></div>
              Your agent
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Core Features -->
    <section
      id="features"
      :ref="(el) => (sectionRefs.features = el as HTMLElement | null)"
      class="px-6 py-14 lg:py-20 scroll-mt-20"
    >
      <div class="max-w-6xl mx-auto">
        <div class="text-center intro" style="--d: 800ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Features</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Everything you need,<br class="sm:hidden" /> nothing you don't</h2>
          <p class="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
            Built for people who ship. No feature bloat, no enterprise theater.
          </p>
        </div>

        <!-- Feature carousel -->
        <div class="mt-12 intro" style="--d: 860ms">
          <!-- Screenshot display -->
          <div class="relative rounded-2xl border border-white/[0.06] bg-black overflow-hidden group">
            <!-- Left/right click zones -->
            <button
              class="absolute left-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer flex items-center justify-start pl-4 opacity-0 group-hover:opacity-100 transition-opacity"
              @click="prevSlide"
            >
              <div class="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/[0.1] flex items-center justify-center">
                <Icon name="heroicons:chevron-left" class="w-5 h-5 text-white" />
              </div>
            </button>
            <button
              class="absolute right-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer flex items-center justify-end pr-4 opacity-0 group-hover:opacity-100 transition-opacity"
              @click="nextSlide"
            >
              <div class="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/[0.1] flex items-center justify-center">
                <Icon name="heroicons:chevron-right" class="w-5 h-5 text-white" />
              </div>
            </button>

            <!-- Image -->
            <Transition :name="slideDirection === 'next' ? 'slide-next' : 'slide-prev'" mode="out-in">
              <img
                :key="activeSlide"
                :src="currentSlide.screenshot"
                :alt="currentSlide.feature"
                class="w-full h-auto screenshot-crisp"
              />
            </Transition>

            <!-- Feature info overlay (bottom) -->
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-5 px-6">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1.5">
                    <Icon :name="currentSlide.icon" class="w-4 h-4 text-emerald-400" />
                    <span class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{{ currentSlide.feature }}</span>
                  </div>
                  <p class="text-sm text-zinc-300 max-w-lg leading-relaxed">{{ currentSlide.desc }}</p>
                </div>
                <span class="text-xs text-zinc-500 flex-shrink-0">{{ currentSlide.label }}</span>
              </div>
            </div>
          </div>

          <!-- Feature group indicators -->
          <div class="flex items-center justify-center gap-3 mt-5">
            <template v-for="(group, gi) in featureGroups" :key="group.name">
              <div class="flex items-center gap-1">
                <button
                  v-for="si in group.count"
                  :key="si"
                  class="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
                  :class="activeSlide === group.startIndex + si - 1
                    ? 'bg-emerald-400 w-6'
                    : activeSlide >= group.startIndex && activeSlide < group.startIndex + group.count
                      ? 'bg-zinc-500 w-1.5'
                      : 'bg-zinc-700 w-1.5 hover:bg-zinc-600'"
                  @click="goToSlide(group.startIndex + si - 1)"
                />
              </div>
              <div v-if="gi < featureGroups.length - 1" class="w-px h-3 bg-white/[0.06]" />
            </template>
          </div>

          <!-- Keyboard hint -->
          <p class="text-center text-[11px] text-zinc-600 mt-2">Click or use arrow keys to navigate</p>
        </div>
      </div>
    </section>

    <!-- Comparison -->
    <section
      id="compare"
      :ref="(el) => (sectionRefs.compare = el as HTMLElement | null)"
      class="px-6 py-14 lg:py-20 scroll-mt-20"
    >
      <div class="max-w-3xl mx-auto">
        <div class="text-center intro" style="--d: 1100ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Compare</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Why not Linear or Jira?</h2>
          <p class="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
            Great tools. Built for humans only. Context is built for the team you actually have: humans and agents working together.
          </p>
        </div>

        <div class="mt-8 rounded-xl border border-white/[0.06] bg-[#0c0c0f]/95 backdrop-blur-xl overflow-hidden intro" style="--d: 1160ms">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-white/[0.06]">
                <th class="text-left px-4 py-3 text-zinc-500 font-medium">Feature</th>
                <th class="px-4 py-3 text-center text-emerald-400 font-semibold">Context</th>
                <th class="px-4 py-3 text-center text-zinc-500 font-medium">Linear</th>
                <th class="px-4 py-3 text-center text-zinc-500 font-medium">Jira</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in comparisonRows"
                :key="row.feature"
                :class="i % 2 === 0 ? 'bg-white/[0.015]' : ''"
              >
                <td class="px-4 py-2.5 text-zinc-300">{{ row.feature }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="row.context" class="text-emerald-400 text-base">&#10003;</span>
                  <span v-else class="text-zinc-700 text-base">&#x2013;</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="row.linear" class="text-zinc-400 text-base">&#10003;</span>
                  <span v-else class="text-zinc-700 text-base">&#x2013;</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="row.jira" class="text-zinc-400 text-base">&#10003;</span>
                  <span v-else class="text-zinc-700 text-base">&#x2013;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Quick Start -->
    <section
      id="quickstart"
      :ref="(el) => (sectionRefs.quickstart = el as HTMLElement | null)"
      class="px-6 py-14 lg:py-20 scroll-mt-20"
    >
      <div class="max-w-3xl mx-auto">
        <div class="text-center intro" style="--d: 1220ms">
          <div class="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Quick Start</div>
          <h2 class="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-100">Up and running in 2 minutes</h2>
          <p class="mt-3 text-sm sm:text-base text-zinc-400">
            No database setup needed. PGlite runs embedded.
          </p>
        </div>

        <div class="mt-8 relative">
          <div class="absolute left-[19px] top-8 bottom-[4.5rem] w-px bg-white/[0.06]" />

          <div class="space-y-6">
            <div
              v-for="(step, i) in quickStartSteps"
              :key="step.num"
              class="flex gap-6 intro"
              :style="{ '--d': `${1280 + i * 60}ms` }"
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

    <!-- Community CTA -->
    <section class="px-6 py-14 lg:py-20">
      <div class="max-w-2xl mx-auto text-center intro" style="--d: 1400ms">
        <h2 class="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">Join the community</h2>
        <p class="mt-3 text-sm sm:text-base text-zinc-400">
          Context is built in the open. Star us, open issues, submit PRs, or just come hang out.
        </p>
        <div class="mt-6 flex items-center justify-center gap-4">
          <a
            href="https://github.com/recursion-endeavours/context"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] border border-white/[0.08] text-zinc-200 font-medium rounded-lg hover:bg-white/[0.1] hover:border-white/[0.15] transition-all text-sm"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            Star on GitHub
          </a>
          <a
            href="#"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5865F2]/10 border border-[#5865F2]/20 text-[#5865F2] font-medium rounded-lg hover:bg-[#5865F2]/20 transition-all text-sm"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            Join Discord
          </a>
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
            <span class="text-sm text-zinc-500">Open-source project management for human-agent teams.</span>
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
        <div
          class="absolute inset-0 bg-black/80 transition-opacity duration-300 cursor-pointer"
          :class="lightboxOpen ? 'opacity-100' : 'opacity-0'"
          @click="closeLightbox"
        />
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
          <div class="rounded-xl border border-white/[0.1] bg-black overflow-hidden">
            <img
              :src="featureSlides[activeSlide]?.screenshot"
              :alt="featureSlides[activeSlide]?.feature"
              class="w-full h-auto screenshot-crisp"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
:deep(html) {
  color-scheme: dark;
}

.hero-dark {
  background-color: transparent;
}

.accent-line {
  background-image: linear-gradient(120deg, #94a3b8, #e2e8f0, #4ade80);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

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

/* Feature carousel slide transitions */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.slide-next-enter-from {
  opacity: 0;
  transform: translateX(60px);
}

.slide-next-leave-to {
  opacity: 0;
  transform: translateX(-60px);
}

.slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-60px);
}

.slide-prev-leave-to {
  opacity: 0;
  transform: translateX(60px);
}

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

/* Terminal */
.terminal-line {
  min-height: 1.4em;
  line-height: 1.4;
}

.terminal-cursor {
  color: #4ade80;
  animation: blink 0.8s step-end infinite;
  font-size: 0.85em;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* Fade up transition */
.fade-up-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Toast slide transition */
.toast-slide-enter-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
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

/* Kanban card transitions */
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
