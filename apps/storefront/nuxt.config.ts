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
    '~/assets/css/forge.css',
    '~/assets/css/impulse.css',
    '~/assets/css/product-description.css',
    // RTL/Arabic conversion — loaded LAST so it wins the cascade over every
    // template's own scoped CSS above (all 14 --font-*-display vars, plus
    // the broad physical-direction utility overrides) without having to
    // touch each template's own stylesheet.
    '~/assets/css/rtl.css'
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
      { name: 'Oswald', provider: 'google' },
      { name: 'Archivo', provider: 'google' },
      // RTL/Arabic conversion — Cairo has full Arabic + Latin coverage across
      // a wide weight range (200–1000) and replaces every template's Latin-
      // only display face (Fraunces, Anton, Cormorant, etc. have zero Arabic
      // glyphs — without this, headings would silently fall back to whatever
      // generic Arabic font each OS/browser ships, ugly and inconsistent
      // across templates). See rtl.css for where it's applied.
      { name: 'Cairo', provider: 'google' }
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
      // NUXT_PUBLIC_API_BASE overrides this at runtime (see
      // server/plugins/validate-env.ts for the Zod validation on the same
      // var) — declaring it here explicitly rather than relying on Nuxt's
      // auto-detection of NUXT_PUBLIC_*-prefixed env vars.
      apiBase: 'http://localhost:3333',
      siteUrl: 'https://amalice.example'
    }
  },
  app: {
    head: {
      // 100% RTL/Arabic storefront (no language switcher — see rtl.css for
      // the corresponding CSS-side conversion). htmlAttrs is the one place
      // dir/lang must be set for SSR: the browser needs dir="rtl" present in
      // the very first HTML response, not applied client-side after hydration,
      // or the page visibly flips from LTR to RTL on load.
      htmlAttrs: {
        lang: 'ar',
        dir: 'rtl'
      },
      titleTemplate: '%s · أماليس',
      title: 'أماليس',
      meta: [
        {
          name: 'description',
          content: 'أماليس — تسوق مع الدفع عند الاستلام، بدون حساب.'
        }
      ]
    }
  }
})
