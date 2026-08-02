// Hostname-only (no protocol/path) for @nuxt/image's `domains` allowlist
// below — read directly from the same env var runtimeConfig.public.apiBase
// resolves at runtime (NUXT_PUBLIC_API_BASE), since nuxt.config itself runs
// at build time and has no other way to know the real API host per
// environment (dev vs. the production api.* subdomain).
const apiHost = (() => {
  try {
    return new URL(process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3333').hostname
  } catch {
    return 'localhost'
  }
})()

export default defineNuxtConfig({
  extends: ['../../packages/ui'],
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxt/image', '@nuxtjs/sitemap'],
  // Disable directory-prefixing for component auto-import so the template-
  // section resolver can address components by exact name: components/home/
  // HomeHero.vue → <HomeHero> (not <HomeHomeHero>), components/editorial/
  // EditorialHomeHero.vue → <EditorialHomeHero>. The filename IS the name.
  components: [{ path: '~/components', pathPrefix: false }],
  // PERFORMANCE: each template's scoped palette CSS (14 files, ~100KB raw
  // combined) used to ALL load globally here regardless of which single
  // template a store actually runs — PageSpeed measured this as a large
  // "unused CSS" chunk shipped to every visitor. Each file now instead lives
  // behind a lazy JS import inside its own layout (app/layouts/*.vue), so
  // Vite code-splits it and only the active template's chunk is ever
  // fetched. minimal has no file; it stays on packages/ui's shared tokens.
  // What stays global: layer-order.css (declares cascade priority once,
  // before either layer has content — see its own comment), rtl-layer.css
  // (rtl.css wrapped so it keeps winning the cascade over every template
  // regardless of lazy-load order), and product-description.css (shared
  // rich-text rendering rules, not template-scoped).
  css: [
    '~/assets/css/layer-order.css',
    '~/assets/css/product-description.css',
    '~/assets/css/rtl-layer.css'
  ],
  // PERFORMANCE: every template's own display face (Fraunces, Space Grotesk,
  // Cormorant, Anton, Poppins, Lora, Sora, Outfit, Bodoni Moda, Bricolage
  // Grotesque, Oswald, Archivo — 12 Latin-only Google Fonts) is DEAD WEIGHT.
  // This storefront is 100% RTL/Arabic (htmlAttrs.dir below is hardcoded
  // 'rtl', no LTR mode exists), and rtl.css unconditionally overrides every
  // template's --font-*-display token to Cairo (`html[dir='rtl'] .tpl-X { }`
  // beats each template's own un-scoped base declaration). Those 12 fonts'
  // own @font-face/preload metadata were shipping and never once rendering —
  // a real, measured chunk of the "unused files" PageSpeed flagged. Only
  // Cairo (full Arabic + Latin coverage, weights 200–1000) is ever painted;
  // Inter/JetBrains Mono still come from packages/ui for prices/SKUs (kept
  // off Cairo per rtl.css's comment). If a template's own file still sets
  // e.g. --font-boutique-display: 'Fraunces', that's just an inert fallback
  // token now — the RTL override always wins since dir is always rtl.
  fonts: {
    // subsets: this storefront only ever renders Arabic script + Latin
    // (brand name, numerals) — restricting away Cairo's other Google-Fonts
    // subsets (cyrillic, greek, vietnamese, etc.) it would otherwise fetch
    // is what fixes Chrome's "preloaded but not used within a few seconds"
    // warning: preload: true (below) was preloading every subset of every
    // weight unconditionally, most of which no page on this site ever uses.
    families: [{ name: 'Cairo', provider: 'google', subsets: ['arabic', 'latin'] }],
    // PERFORMANCE: @nuxt/fonts only auto-preloads a @font-face subset when it
    // has NO unicodeRange — Cairo (Latin + Arabic coverage) is served as
    // multiple Google-Fonts unicode-range subsets, so every one of them was
    // silently excluded from auto-preload by that heuristic. That's why the
    // font was discovered late in the critical request chain (after CSS
    // parse) instead of starting early — PageSpeed measured ~1s lost to it.
    // Forcing preload on unconditionally overrides that heuristic.
    defaults: { preload: true }
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
    // Cloudflare R2 per plan §6). Adding a domain here makes @nuxt/image
    // route it through IPX's REMOTE proxy: fetch the original from that
    // origin, decode, resize, re-encode, then respond — real per-request
    // server-side work, not a cache lookup. Tried adding the API's own
    // upload host here to shrink oversized thumbnails; it backfired badly —
    // LCP roughly doubled (measured live) because the transcode round-trip
    // for the main product image is far slower than just serving the
    // already-reasonably-sized original AVIF directly. Reverted. The right
    // fix for oversized uploads is generating properly-sized variants ONCE
    // at upload time on the API (sharp is already a dependency there), not
    // an on-demand remote transform on every storefront request.
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
      ],
      // PageSpeed's "preconnect candidates" flag: the LCP product image and
      // every API call go to a different origin (api.*) than the document
      // itself, and the pixel scripts (when enabled) go to Meta/TikTok's
      // domains — each is a fresh DNS+TLS handshake the browser would
      // otherwise only start once it discovers the first real request for
      // that origin partway through parsing. Warming the connection early
      // shaves that latency off the critical path.
      link: [
        { rel: 'preconnect', href: `https://${apiHost}` },
        { rel: 'preconnect', href: 'https://connect.facebook.net' },
        { rel: 'preconnect', href: 'https://analytics.tiktok.com' }
      ]
    }
  }
})
