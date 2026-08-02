# apps/storefront

Nuxt 4 **SSR** customer-facing storefront. 100% RTL/Arabic (no LTR mode exists — `htmlAttrs.dir` is hardcoded `'rtl'` in `nuxt.config.ts`), single-tenant per deployment, with **15 selectable visual templates** (minimal + 14 named templates) swapped at runtime via an admin setting, not at build time.

## Template architecture — read this before touching chrome, pages, or CSS

The active template comes from `GET /settings` (`useStoreSettings()`), fetched once per SSR request and cached under the Nuxt payload key `'store-settings'`. **`app/app.vue` awaits this fetch before `<NuxtLayout>` picks a layout** — skipping that await is the classic bug here (wrong template's chrome flashes on first SSR pass).

- **Layouts**: one per template in `app/layouts/*.vue` (`minimal.vue` has no dedicated CSS — it's the shared Polaris baseline). Nuxt's own layout system already lazy-loads these; no extra work needed there.
- **Pages/sections**: `app/components/TemplatePage.vue` and `TemplateSection.vue` resolve `(pageName/sectionName, activeTemplate)` → the right presentational component, falling back to the bare `minimal` version. Every override is `defineAsyncComponent` (dynamic `import()`), **wrapped in `<Suspense>`** — both are load-bearing, not incidental:
  - `defineAsyncComponent` (not a static import) is why a single-template store doesn't ship all 14 other templates' JS to every visitor. Removing it re-introduces a real, measured ~190KB-of-unused-JS regression.
  - `<Suspense>` is why hydration doesn't break. Vue's SSR renderer only *awaits* an async component's resolution inside a Suspense boundary — without one, the server renders full HTML fine, but the client can't hydrate against the still-unresolved async wrapper and discards+rebuilds that subtree from scratch (a real hydration-mismatch bug that shipped once already — see git history on these two files).
  - Adding a 15th template or a new page/section type: add the async import to the relevant `OVERRIDES` map in whichever of these two files applies. Don't add a static top-level import for a template-specific component anywhere else in the codebase.

## CSS — cascade layers, not load order

Per-template palette CSS (`app/assets/css/<template>.css`) is **not** in the global `css:` array in `nuxt.config.ts` — each file is lazy-imported from its own layout (`app/layouts/<template>.vue`, wrapped via `app/assets/css/layers/<template>.css`'s `@import '../<template>.css' layer(template);`), so only the active template's CSS chunk is ever fetched.

`rtl.css` must still unconditionally win the cascade over whichever template is active, including one loaded lazily *after* it in the DOM. That's what `app/assets/css/layer-order.css` (`@layer template, rtl-override;`, loaded first, globally) and `rtl-layer.css` (wraps `rtl.css` in the `rtl-override` layer) do — **CSS layer declaration order controls priority, not DOM insertion order**, so this holds regardless of when each lazy chunk actually loads. If you add CSS that needs to beat every template unconditionally, wrap it the same way rather than relying on `<link>` position.

`rtl.css` itself doesn't (and can't safely) blanket-flip every physical-direction Tailwind utility (`ml-`, `pr-`, `left-`, etc.) across ~200 component files — new components should use logical-property utilities (`ms-`, `pe-`, `start-`, `border-s`, etc.) directly, which respond to `dir` with zero extra CSS, rather than adding a new override rule to `rtl.css`.

## Fonts

`nuxt.config.ts`'s `fonts.families` should only ever list what's actually reachable given the RTL-only constraint above: Cairo (full Arabic+Latin coverage) is the only font that ever paints, since `rtl.css` overrides every template's `--font-*-display` token unconditionally. Do not add a template's "native" Latin display font (Fraunces, Anton, etc.) back to this list on the theory that a template needs its own personality — it's dead weight that PageSpeed will flag, and the RTL override always wins anyway. If a genuine LTR mode is ever added, this whole assumption needs revisiting.

## Images

`resolveImageUrl()` (`app/composables/useApi.ts`) turns a relative `/uploads/...` path into an absolute URL against `apiBase`, or passes an already-absolute URL through unchanged. **Always call it before handing a locally-uploaded image URL to `<NuxtImg>`/`<img>`** — uploads only physically exist on `apps/api`'s server, not this one, so a raw relative path resolves to nothing here (this has been a real, shipped bug more than once: `ImpulseProductCard.vue`, `cart.ts`'s `addItem`).

`@nuxt/image`'s `domains` config (in `nuxt.config.ts`) should **not** include the API's upload host. Adding it routes images through IPX's remote fetch-and-transcode proxy — real per-request server work, not a cache hit — and has caused a measured LCP regression (doubled) when tried for the main product image. The correct fix for oversized uploads is generating properly-sized variants once at upload time on `apps/api` (via `sharp`, already a dependency there), not an on-demand transform here.

LCP images (PDP gallery hero) need `loading="eager"`, `preload`, and `fetchpriority="high"` explicitly — don't assume `preload` alone sets `fetchpriority`.

## Pixel tracking (Meta + TikTok)

`app/composables/useMetaPixel.ts` / `useTikTokPixel.ts` — both retry-safe (`window.fbq`/`window.ttq` stubs are injected asynchronously by `MetaPixelScript.vue`/`TikTokPixelScript.vue`, so an event fired immediately on mount can race ahead of the stub existing; both composables retry via `setInterval`, 200ms × 25 attempts, before giving up).

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
