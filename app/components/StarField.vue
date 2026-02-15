<script setup lang="ts">
const props = withDefaults(defineProps<{ delay?: number }>(), { delay: 800 })

const canvas = ref<HTMLCanvasElement | null>(null)
const visible = ref(false)

interface Star {
  x: number
  y: number
  r: number
  baseAlpha: number
  phase: number
  speed: number
}

onMounted(() => {
  const el = canvas.value
  if (!el) return

  const ctx = el.getContext('2d')
  if (!ctx) return

  let stars: Star[] = []
  let raf: number
  let scrollY = 0
  let smoothScrollY = 0       // lerped toward scrollY for momentum/inertia
  let prevSmoothScrollY = 0
  let scrollGlow = 0          // smoothed 0→1 glow intensity driven by scroll speed

  const resize = () => {
    el.width = window.innerWidth
    el.height = window.innerHeight
    seed()
  }

  const seed = () => {
    // Extra height so stars don't disappear when shifted up by parallax
    const fieldH = el.height * 1.6
    const count = Math.floor((el.width * fieldH) / 8000)
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * el.width,
      y: Math.random() * fieldH,
      r: Math.random() * 0.9 + 0.2,
      baseAlpha: Math.random() * 0.3 + 0.08,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.8 + 0.3,
    }))
  }

  const onScroll = () => { scrollY = window.scrollY }

  const draw = (t: number) => {
    ctx.clearRect(0, 0, el.width, el.height)

    // Momentum: smoothScrollY eases toward real scrollY
    smoothScrollY += (scrollY - smoothScrollY) * 0.08

    // Smooth scroll-glow: ramp up fast, decay slowly
    const scrollDelta = Math.abs(smoothScrollY - prevSmoothScrollY)
    prevSmoothScrollY = smoothScrollY
    const target = Math.min(scrollDelta / 30, 1)   // normalise speed → 0-1
    const rate = target > scrollGlow ? 0.12 : 0.06  // fast attack, slow release
    scrollGlow += (target - scrollGlow) * rate

    const parallaxOffset = smoothScrollY * 0.06

    for (const s of stars) {
      const twinkle = Math.sin(t * 0.001 * s.speed + s.phase)
      const alpha = s.baseAlpha + twinkle * s.baseAlpha * 0.9
      const sy = s.y - parallaxOffset
      if (sy < -10 || sy > el.height + 10) continue

      // Glow: boost alpha + expand radius when scrolling
      const glowAlpha = alpha + scrollGlow * 0.25
      const r = s.r + scrollGlow * s.r * 1.2

      ctx.beginPath()
      ctx.arc(s.x, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, glowAlpha))})`
      ctx.fill()
    }

    raf = requestAnimationFrame(draw)
  }

  resize()
  raf = requestAnimationFrame(draw)
  window.addEventListener('resize', resize)
  window.addEventListener('scroll', onScroll, { passive: true })
  setTimeout(() => { visible.value = true }, props.delay)

  onUnmounted(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  })
})
</script>

<template>
  <canvas
    ref="canvas"
    class="fixed inset-0 -z-10 pointer-events-none transition-opacity duration-[2s]"
    :class="visible ? 'opacity-100' : 'opacity-0'"
    aria-hidden="true"
  />
</template>
