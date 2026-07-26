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
  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
      { name: 'JetBrains Mono', provider: 'google' }
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
