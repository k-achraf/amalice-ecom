# apps/storefront

Nuxt 4 **SSR** customer-facing storefront. 100% RTL/Arabic (no LTR mode exists — `htmlAttrs.dir` is hardcoded `'rtl'` in `nuxt.config.ts`), single-tenant per deployment, with **15 selectable visual templates** (minimal + 14 named templates) swapped at runtime via an admin setting, not at build time.

## Template architecture — read this before touching chrome, pages, or CSS

The active template comes from `GET /settings` (`useStoreSettings()`), fetched once per SSR request and cached under the Nuxt payload key `'store-settings'`. **`app/app.vue` awaits this fetch before `<NuxtLayout>` picks a layout** — skipping that await is the classic bug here (wrong template's chrome flashes on first SSR pass).

- **Layouts**: one per template in `app/layouts/*.vue` (`minimal.vue` has no dedicated CSS — it's the shared Polaris baseline). Nuxt's own layout system already lazy-loads these; no extra work needed there.
- **Pages/sections**: `app/components/TemplatePage.vue` and `TemplateSection.vue` resolve `(pageName/sectionName, activeTemplate)` → the right presentational component, falling back to the bare `minimal` version. Every override goes through each file's own `lazy()` helper — `defineAsyncComponent({ loader, hydrate: hydrateOnIdle() })` — not a plain `defineAsyncComponent(loader)` and not wrapped in `<Suspense>`. Both parts are load-bearing:
  - The dynamic `import()` loader (not a static import) is why a single-template store doesn't ship all 14 other templates' JS to every visitor. Removing it re-introduces a real, measured ~190KB-of-unused-JS regression.
  - `<Suspense>` was tried once (to fix a "Hydration Mismatch" diagnostic) and reverted — it renders nothing for the whole subtree while the client-side chunk fetch is pending, causing a measured CLS regression (0.001 → 1.000, the max possible) and gating the LCP element (which lives inside this subtree) from existing in the DOM until the chunk resolved. Reverting Suspense without another strategy just brings the hydration-mismatch warning back, though (Vue can't cleanly hydrate an unresolved async component with no guidance).
  - **The actual fix for both at once is Vue 3.5's lazy-hydration API** (`hydrate: hydrateOnIdle()`, imported from `'vue'`): it keeps the SSR-rendered DOM exactly as painted — visible immediately, no blanking, no CLS — and only attaches reactivity/event listeners once the browser is idle. This is different from Suspense's "unmount subtree and wait" behavior. Known tradeoff: interactive elements in this subtree (e.g. a `ProductCard`'s add-to-cart button) won't respond to a click that lands before the idle callback fires — acceptable since idle typically resolves well under human reaction time, but worth knowing if a report ever mentions an occasional unresponsive first click.
  - Adding a 15th template or a new page/section type: add the async import to the relevant `OVERRIDES` map via the same `lazy()` helper in whichever of these two files applies. Don't add a static top-level import for a template-specific component anywhere else in the codebase, and don't swap `lazy()` back to a plain `defineAsyncComponent()` or add `<Suspense>` — both regress a measured metric.

## CSS — cascade layers, not load order

Per-template palette CSS (`app/assets/css/<template>.css`) is **not** in the global `css:` array in `nuxt.config.ts` — each file is lazy-imported from its own layout (`app/layouts/<template>.vue`, wrapped via `app/assets/css/layers/<template>.css`'s `@import '../<template>.css' layer(template);`), so only the active template's CSS chunk is ever fetched.

`rtl.css` must still unconditionally win the cascade over whichever template is active, including one loaded lazily *after* it in the DOM. That's what `app/assets/css/layer-order.css` (`@layer template, rtl-override;`, loaded first, globally) and `rtl-layer.css` (wraps `rtl.css` in the `rtl-override` layer) do — **CSS layer declaration order controls priority, not DOM insertion order**, so this holds regardless of when each lazy chunk actually loads. If you add CSS that needs to beat every template unconditionally, wrap it the same way rather than relying on `<link>` position.

`rtl.css` itself doesn't (and can't safely) blanket-flip every physical-direction Tailwind utility (`ml-`, `pr-`, `left-`, etc.) across ~200 component files — new components should use logical-property utilities (`ms-`, `pe-`, `start-`, `border-s`, etc.) directly, which respond to `dir` with zero extra CSS, rather than adding a new override rule to `rtl.css`.

## Fonts

`nuxt.config.ts`'s `fonts.families` should only ever list what's actually reachable given the RTL-only constraint above: Cairo (full Arabic+Latin coverage) is the only font that ever paints, since `rtl.css` overrides every template's `--font-*-display` token unconditionally. Do not add a template's "native" Latin display font (Fraunces, Anton, etc.) back to this list on the theory that a template needs its own personality — it's dead weight that PageSpeed will flag, and the RTL override always wins anyway. If a genuine LTR mode is ever added, this whole assumption needs revisiting.

`fonts: { defaults: { preload: true } }` is required, not optional, for a font like Cairo. `@nuxt/fonts` only auto-preloads a `@font-face` when it has no `unicodeRange` — but a font covering both Latin and Arabic gets served as multiple Google-Fonts unicode-range subsets, so every one of them is silently excluded from auto-preload by that heuristic unless overridden. Without this, the font is discovered late in the critical request chain (after CSS parse) instead of starting early — measured as ~1s of avoidable critical-path latency.

Pair that with `subsets: ['arabic', 'latin']` on the family entry — without it, `preload: true` forces every Google-Fonts subset (cyrillic, greek, vietnamese, etc., none of which this storefront ever renders) to preload unconditionally, which trades the late-discovery problem for Chrome's "preloaded but not used within a few seconds" warning instead. Restricting subsets is what actually fixes both at once.

## Images

`resolveImageUrl()` (`app/composables/useApi.ts`) turns a relative `/uploads/...` path into an absolute URL against `apiBase`, or passes an already-absolute URL through unchanged. **Always call it before handing a locally-uploaded image URL to `<NuxtImg>`/`<img>`** — uploads only physically exist on `apps/api`'s server, not this one, so a raw relative path resolves to nothing here (this has been a real, shipped bug more than once: `ImpulseProductCard.vue`, `cart.ts`'s `addItem`).

`@nuxt/image`'s `domains` config (in `nuxt.config.ts`) should **not** include the API's upload host. Adding it routes images through IPX's remote fetch-and-transcode proxy — real per-request server work, not a cache hit — and has caused a measured LCP regression (doubled) when tried for the main product image. The correct fix for oversized uploads is generating properly-sized variants once at upload time on `apps/api` (via `sharp`, already a dependency there), not an on-demand transform here.

LCP images (PDP gallery hero) need `loading="eager"`, `preload`, and `fetchpriority="high"` explicitly — don't assume `preload` alone sets `fetchpriority`.

## Pixel tracking (Meta + TikTok)

`app/composables/useMetaPixel.ts` / `useTikTokPixel.ts` — both retry-safe (`window.fbq`/`window.ttq` stubs are injected asynchronously by `MetaPixelScript.vue`/`TikTokPixelScript.vue`, so an event fired immediately on mount can race ahead of the stub existing; both composables retry via `setInterval`, 200ms × 25 attempts, before giving up).

The actual third-party script tag (`fbevents.js`, TikTok's SDK) is gated behind `useDeferredLoad()` (`app/composables/useDeferredLoad.ts`) — first user interaction or an idle-callback budget (~3.5s), whichever comes first — so it's absent from the initial SSR HTML entirely and never competes with first paint for bandwidth/CPU. The composables' existing retry loop is what makes this safe: an event fired before the script has loaded (e.g. a route-change `PageView`) just retries until `fbq`/`ttq` exists. The small same-origin config fetch (`/apps/meta-pixel`, `/apps/tiktok-pixel`) stays eager and ungated — it's cheap and Meta's `noscript` fallback pixel needs the resolved `pixelId` available at SSR time to still work for no-JS visitors.

`ViewContent`/similar one-per-entity events must key their "already fired" guard to the entity id, not a plain boolean — Vue/Nuxt Router **reuses the same component instance** across client-side navigations that match the same route file (e.g. `/products/A` → `/products/B`, same `[slug].vue`), so a boolean flag doesn't reset and the event only ever fires once per session instead of once per product.

`Purchase` fires from both the browser pixel and the server (`apps/api`'s `orders.service.ts`) sharing the same `event_id` (`orderId`) — this is intentional deduplicated redundancy against ad-blockers/ITP, not a double-count bug. Don't "fix" this by removing one side.

## Dev

```bash
pnpm --filter storefront dev      # http://localhost:3000
pnpm --filter storefront typecheck
pnpm --filter storefront lint     # eslint + prettier --check
```

`NUXT_PUBLIC_API_BASE` must be exported in the actual shell at **build** time (not just present in a runtime `.env`) — `nuxt.config.ts` reads it via `process.env` at module-eval time (for `image.domains`'s host and the preconnect hint), separately from Nuxt's own runtime injection into `runtimeConfig.public.apiBase`. See `DEPLOYMENT.md`.

## Conventions

- Lead-form / checkout fields, wilaya/commune pickers, and shipping-price logic are duplicated across all 15 templates by design (each template owns its own markup) — a shared-data change (e.g. a new required field) still needs threading through every template's own component, there's no single shared form component to edit.
- See the `polaris-design-language` skill (`.agents/skills/`) before changing shared/minimal-template tokens or chrome.
