import { createResolver } from '@nuxt/kit'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' }
    }
  },
  // `~/...` resolves against the *consuming app's* srcDir, not this layer's
  // own — an absolute path anchored to this file is required so apps that
  // extend this layer actually find packages/ui's own main.css.
  css: [resolve('./app/assets/css/main.css')],
  // provider: 'bunny' — not a stylistic choice, a build-reliability fix.
  // @nuxt/fonts 0.14.0's bundled Google Fonts metadata resolves Inter to a
  // gstatic.com URL that 404s (confirmed live: Google's own CSS2 API
  // returns a different, working hash for the same family/weight — the
  // module's snapshot is stale), which fails `nuxt build` outright since
  // this module self-hosts fonts at build time. Bunny Fonts mirrors the
  // same Google Fonts catalog (same family names/weights) on infrastructure
  // @nuxt/fonts resolves correctly, so this is a drop-in swap with no visual
  // change — not a switch to a different typeface.
  fonts: {
    families: [
      { name: 'Inter', provider: 'bunny' },
      { name: 'JetBrains Mono', provider: 'bunny' }
    ]
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    storageKey: 'amalice-color-mode'
  },
  icon: {
    collections: ['lucide'],
    serverBundle: { collections: ['lucide'] }
  }
})
