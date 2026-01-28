import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app/**/*.{js,vue,ts}',
    './app.vue',
  ],
  safelist: [
    // Status colors
    'bg-slate-100', 'text-slate-500', 'text-slate-600',
    'bg-emerald-50', 'text-emerald-600',
    'bg-violet-50', 'text-violet-600',
    'bg-blue-50', 'text-blue-600',
    'bg-amber-50', 'text-amber-600',
    'bg-cyan-50', 'text-cyan-600',
    'bg-rose-50', 'text-rose-600',
    'bg-orange-50', 'text-orange-600',
    'bg-pink-50', 'text-pink-600',
    'bg-slate-50', 'text-slate-400',
  ],
  theme: {
    extend: {
      colors: {
        // Relai brand colors
        relai: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // Status colors
        hot: '#ef4444',
        warm: '#f97316',
        cold: '#3b82f6',
        stale: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
