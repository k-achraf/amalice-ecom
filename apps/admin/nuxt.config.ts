export default defineNuxtConfig({
  extends: ['../../packages/ui'],
  modules: ['@pinia/nuxt'],
  // admin.css is the DS-09 Polaris×Stripe override layer — imported AFTER the
  // shared layer's main.css (pulled in transitively via `extends`) so it wins
  // on equal specificity. Admin-scoped only; the storefront doesn't import it.
  css: ['~/assets/css/admin.css'],
  ssr: false,
  compatibilityDate: '2026-07-17',
  devServer: { port: 3001 },
  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_API_BASE_URL overrides this at runtime.
      apiBase: 'http://localhost:3333'
    }
  },
  app: {
    head: {
      titleTemplate: '%s · Amalice Admin',
      title: 'Amalice Admin'
    }
  }
})
