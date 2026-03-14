// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-26',
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
  ],

  nitro: {
    experimental: {
      websocket: true,
    },
    externals: {
      inline: [],
      external: ['node-pty'],
    },
    rollupConfig: {
      external: ['node-pty'],
    },
    unenv: {
      external: ['node-pty'],
    },
  },

  tailwindcss: {
    cssPath: './assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },

  app: {
    head: {
      title: 'ClawLab',
      meta: [
        { name: 'description', content: 'Multi-stakeholder project management with AI' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    postmarkApiToken: process.env.POSTMARK_API_TOKEN,
    public: {
      appName: 'ClawLab',
      appUrl: process.env.APP_URL || 'http://localhost:3000'
    }
  }
})
