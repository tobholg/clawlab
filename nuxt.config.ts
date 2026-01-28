// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-26',
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
  ],

  tailwindcss: {
    cssPath: './assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },

  app: {
    head: {
      title: 'Relai',
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
    public: {
      appName: 'Relai',
      appUrl: process.env.APP_URL || 'http://localhost:3000'
    }
  }
})
