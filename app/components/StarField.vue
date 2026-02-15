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

  const resize = () => {
    el.width = window.innerWidth
    el.height = window.innerHeight
    seed()
  }

  const seed = () => {
    const count = Math.floor((el.width * el.height) / 8000)
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * el.width,
      y: Math.random() * el.height,
      r: Math.random() * 0.9 + 0.2,
      baseAlpha: Math.random() * 0.3 + 0.08,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.8 + 0.3,
    }))
  }

  const draw = (t: number) => {
    ctx.clearRect(0, 0, el.width, el.height)

    for (const s of stars) {
      const twinkle = Math.sin(t * 0.001 * s.speed + s.phase)
      const alpha = s.baseAlpha + twinkle * s.baseAlpha * 0.9
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`
      ctx.fill()
    }

    raf = requestAnimationFrame(draw)
  }

  resize()
  raf = requestAnimationFrame(draw)
  window.addEventListener('resize', resize)
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
