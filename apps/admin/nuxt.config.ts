import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // The admin no longer extends packages/ui (that layer is Nuxt UI-based and
  // storefront-only now). Design tokens live in ads.css; components in
  // app/components/ads.
  modules: ['@pinia/nuxt', '@nuxt/fonts', '@nuxtjs/color-mode'],
  css: ['~/assets/css/ads.css'],
  colorMode: { preference: 'system', fallback: 'light', storageKey: 'amalice-color-mode', classSuffix: '' },
  // provider: 'bunny' — @nuxt/fonts' bundled Google Fonts metadata for Inter 404s
  // at build time; Bunny Fonts mirrors the same catalog (same family/weights).
  fonts: { families: [{ name: 'Inter', provider: 'bunny' }, { name: 'JetBrains Mono', provider: 'bunny' }] },
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
    plugins: [tailwindcss()],
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
      // display/copy). Defaults to the real production domain (see
      // main.ts's CORS list) rather than localhost, since this is an SPA:
      // runtimeConfig.public is baked in at BUILD time, and a prod build run
      // without NUXT_PUBLIC_STOREFRONT_BASE set in the shell would otherwise
      // silently ship localhost links to real admins. Override for local
      // dev via NUXT_PUBLIC_STOREFRONT_BASE=http://localhost:3000.
      storefrontBase: 'https://amalice.shop'
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      titleTemplate: '%s · Amalice Admin',
      title: 'Amalice Admin'
    }
  }
})
