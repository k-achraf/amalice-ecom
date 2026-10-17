import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // The admin no longer extends packages/ui (that layer is Nuxt UI-based and
  // storefront-only now). Design tokens live in ads.css; components in
  // app/components/ads.
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/ads.css'],
  // Outfit is self-hosted via @fontsource-variable/outfit (imported in ads.css);
  // no font module: @nuxt/fonts' dev handler 500s on stale font URLs.
  ssr: false,
  // SPA shell paints a spinner instead of a blank white page while the bundle loads.
  spaLoadingTemplate: true,
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
      // Pre-bundle everything up front: a dep Vite discovers mid-session triggers a
      // re-optimize + full reload, which shows up as a blank page / 504 'Outdated Optimize Dep'.
      include: ['reka-ui', 'lucide-vue-next', '@tanstack/vue-table', 'vue-sonner', 'class-variance-authority', 'clsx', 'tailwind-merge', '@tiptap/core', '@tiptap/vue-3', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-link', 'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers']
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
      storefrontBase: 'https://amalice.shop',
      // Base URL of the standalone funnels site (apps/funnels), used to build the public link of a
      // funnel: <funnelsBase>/f/<slug>. Same build-time caveat as above; override with
      // NUXT_PUBLIC_FUNNELS_BASE=http://localhost:3002 for local dev (see apps/admin/.env.example).
      funnelsBase: 'https://leezil.com'
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [{ rel: 'icon', href: '/img/leezil-icon-teal.svg', type: 'image/svg+xml' }],
      titleTemplate: '%s — Leezil Admin',
      title: 'Leezil Admin'
    }
  }
})
