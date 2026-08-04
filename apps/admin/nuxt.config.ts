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
  // RichTextEditor.vue imports these Tiptap packages directly (it builds the
  // Editor itself rather than going through @nuxt/ui's <UEditor>) — leaf
  // imports Vite's dep scanner never sees ahead of time since they're not
  // package.json entry points. Without this, Vite discovers them only once
  // that route actually loads and re-optimizes mid-session, which can
  // surface as odd module-identity mismatches on first visit. Pre-bundling
  // them here keeps everything in one pass.
  vite: {
    optimizeDeps: {
      include: ['@tiptap/core', '@tiptap/vue-3', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-link']
    }
  },
  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_API_BASE overrides this at runtime.
      apiBase: 'http://localhost:3333',
      // Base URL of the customer-facing storefront — used to build shareable
      // product-page/landing-page links (product preview, landing-page URL
      // display/copy). NUXT_PUBLIC_STOREFRONT_BASE overrides this at runtime.
      storefrontBase: 'http://localhost:3000'
    }
  },
  app: {
    head: {
      titleTemplate: '%s · Amalice Admin',
      title: 'Amalice Admin'
    }
  }
})
