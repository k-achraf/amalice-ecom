export default defineNuxtConfig({
  extends: ['../../packages/ui'],
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxt/image', '@nuxtjs/sitemap'],
  // Disable directory-prefixing for component auto-import so the template-
  // section resolver can address components by exact name: components/home/
  // HomeHero.vue → <HomeHero> (not <HomeHomeHero>), components/editorial/
  // EditorialHomeHero.vue → <EditorialHomeHero>. The filename IS the name.
  components: [{ path: '~/components', pathPrefix: false }],
  // Each of these is a scoped per-template palette (loaded globally but only
  // takes effect under that template's .tpl-* wrapper the layout applies) —
  // same isolation discipline as the admin's admin.css. minimal has no file
  // here; it stays on the shared Polaris tokens from packages/ui.
  css: [
    '~/assets/css/promify.css',
    '~/assets/css/boutique.css',
    '~/assets/css/editorial.css',
    '~/assets/css/nova.css',
    '~/assets/css/atelier.css',
    '~/assets/css/drop.css',
    '~/assets/css/bloom.css',
    '~/assets/css/hearth.css',
    '~/assets/css/volt.css',
    '~/assets/css/pulse.css',
    '~/assets/css/lumiere.css',
    '~/assets/css/trove.css',
    '~/assets/css/forge.css'
  ],
  // Fraunces (Boutique's serif display face), Space Grotesk (Nova's heavy
  // display face), Cormorant (Atelier's delicate jewelry-catalog serif),
  // Anton (Drop's ultra-condensed streetwear display face), Poppins
  // (Bloom's rounded beauty display face), Lora (Hearth's warm home-goods
  // serif), Sora (Volt's geometric tech display face), Outfit (Pulse's
  // rounded gadget display face), Bodoni Moda (Lumière's oversized
  // beauty-editorial didone serif), Bricolage Grotesque (Trove's quirky
  // accessories display face), and Oswald (Forge's condensed industrial
  // display face) — self-hosted via @nuxt/fonts, additive to packages/ui's
  // Inter/JetBrains Mono families. Referenced as `font-family: '<name>', ...`
  // solely inside their own template's scoped CSS/classes; other templates
  // never load them in their critical path since they're only *referenced*,
  // not force-applied, elsewhere.
  fonts: {
    families: [
      { name: 'Fraunces', provider: 'google' },
      { name: 'Space Grotesk', provider: 'google' },
      { name: 'Cormorant', provider: 'google' },
      { name: 'Anton', provider: 'google' },
      { name: 'Poppins', provider: 'google' },
      { name: 'Lora', provider: 'google' },
      { name: 'Sora', provider: 'google' },
      { name: 'Outfit', provider: 'google' },
      { name: 'Bodoni Moda', provider: 'google' },
      { name: 'Bricolage Grotesque', provider: 'google' },
      { name: 'Oswald', provider: 'google' }
    ]
  },
  compatibilityDate: '2026-07-17',
  devServer: { port: 3000 },
  // SF-19 — site URL feeds the sitemap/robots canonical URLs and structured
  // data. Override via NUXT_PUBLIC_SITE_URL in production.
  site: {
    url: 'https://amalice.example',
    name: 'Amalice'
  },
  image: {
    // External image domains (seed uses picsum.photos; production points at
    // Cloudflare R2 per plan §6). Adding the provider domain here lets
    // @nuxt/image optimize them.
    domains: ['picsum.photos', 'images.unsplash.com'],
    format: ['webp', 'jpg']
  },
  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_API_BASE_URL overrides this at runtime (see
      // server/plugins/validate-env.ts for the Zod validation on the same
      // var) — declaring it here explicitly rather than relying on Nuxt's
      // auto-detection of NUXT_PUBLIC_*-prefixed env vars.
      apiBase: 'http://localhost:3333',
      siteUrl: 'https://amalice.example'
    }
  },
  app: {
    head: {
      titleTemplate: '%s · Amalice',
      title: 'Amalice',
      meta: [
        {
          name: 'description',
          content: 'Amalice — cash on delivery shopping, no account required.'
        }
      ]
    }
  }
})
