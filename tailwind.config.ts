import type { Config } from 'tailwindcss'

export default {
  darkMode: 'media',
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app/**/*.{js,vue,ts}',
    './app.vue',
  ],
  safelist: [
    // Status colors (light)
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
    // Risk pill colors (used in computed riskClasses)
    'bg-rose-100', 'text-rose-700', 'bg-amber-100', 'text-amber-700', 'bg-emerald-100', 'text-emerald-700',
    // Document avatar colors (used in computed getDocColor)
    'dark:bg-blue-900/30', 'dark:text-blue-400',
    'dark:bg-emerald-900/30', 'dark:text-emerald-400',
    'dark:bg-violet-900/30', 'dark:text-violet-400',
    'dark:bg-rose-900/30', 'dark:text-rose-400',
    'dark:bg-amber-900/30', 'dark:text-amber-400',
    'dark:bg-cyan-900/30', 'dark:text-cyan-400',
    // Status colors (dark)
    'dark:bg-slate-800', 'dark:text-slate-400',
    'dark:bg-orange-900/30', 'dark:text-orange-400',
    'dark:bg-pink-900/30', 'dark:text-pink-400',
  ],
  theme: {
    extend: {
      colors: {
        // Context brand colors
        ctx: {
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
        // Linear-inspired dark mode neutrals
        dm: {
          DEFAULT: '#09090b',
          surface: '#050506',
          card: '#111113',
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
