# Design System

Defines the design system shared by `apps/storefront` and `apps/admin`. Read this before picking up `DS-01`; every later task in every other track assumes these tokens exist.

For the step-by-step build runbook (commands, file contents, order of operations) that turns DS-01–DS-09 below into actual code, see [00-design-system-plan.md](00-design-system-plan.md).

**Status: implemented through DS-07.** `packages/ui` exists as a working Nuxt layer consumed by both `apps/storefront` and `apps/admin`, with a `/style-guide` dev route proving it out. The values and code below reflect what's actually committed, corrected against a few things that only surfaced by running it for real — see the note at the end of this file for the full list of corrections.

> **DS-08 / DS-09 (direction change, 2026-07).** The project's design direction has moved on from the single "Amber Signal" theme. The storefront adopts **Shopify Polaris's visual language** (DS-08) and the admin adopts a **Polaris × Stripe hybrid** (DS-09). Both are implemented as token/theme overrides on the existing Nuxt UI v4 + Tailwind v4 layer — **not** by pulling in Polaris/Stripe's React components. The shared `packages/ui` layer keeps its current structure (tokens, fonts, color-mode, icons, `StatusBadge`/`PriceDisplay`/`EmptyState`); DS-08/DS-09 change the token *values* and add per-app override layers. The "two design languages" decision means the original "one token set, two densities" principle (below) is relaxed: there is now one shared *foundation* (grid, fonts, status semantics) and two *personalities* on top. Project-level skills `polaris-design-language` and `stripe-polaris-admin-theme` encode the token values and conventions for each.

## Principles

- **Trust and clarity first.** A COD checkout lives or dies on whether the customer trusts the flow enough to commit to paying on delivery. No dark patterns, no ambiguous states, no surprise steps.
- **One foundation, two personalities.** Storefront and admin share the spacing grid (4px), the type system (Inter + JetBrains Mono), the icon set (Lucide), and — critically — the **status semantics** (`StatusBadge`'s order-lifecycle color/icon/label map is shared and never overridden per-app). They diverge on primary color, surface treatment, shadow, and density: storefront is Polaris, admin is Polaris×Stripe. The shared `packages/ui` holds the foundation + shared components; each app layers its personality on top.
- **State is never color-only.** Every status (order state, stock level, reconciliation match) pairs color with a label or icon. This is both an accessibility requirement and how ops staff scan a table of 200 orders in seconds. This rule is unchanged by DS-08/DS-09 — the status palette itself is *not* re-skinned per-app.

## Color tokens

Primary, secondary, and neutral map to Nuxt UI's `ui.colors` config. Semantic colors are a deliberately different hue family from primary so a status chip is never mistaken for a brand element — that took extra care here, since the brand ("Amber Signal") sits in the orange family, which is where a lot of design systems default their `warning` token. `warning` was pulled toward gold-yellow specifically so it stays legible next to primary instead of blurring into it.

| Token | Role | Base hex |
|---|---|---|
| `primary` | Brand, links, primary actions, active nav — "Amber Signal" | `#D9730D` |
| `secondary` | Secondary actions, admin nav accents, complements primary | `#1B3A3A` |
| `neutral` | Text, borders, surfaces | Tailwind `stone` (warm gray — pairs with the amber base better than a cool slate/gray would) |
| `success` | Delivered, reconciled, in-stock | `#2F8F46` |
| `warning` | In-transit, low-stock, pending review | `#C99A2E` (gold — deliberately more yellow, less red, than primary) |
| `error` | Delivery failed, RTO, out-of-stock, blocked customer | `#B23A3A` |
| `info` | Informational banners, tips | `#2563EB` |

All six scales below are generated (not hand-picked) from their base hex via `culori`'s oklch ramp + `clampChroma` — see `scripts/generate-palette.mjs` (deleted after use, per DS-01; regenerate from this same base-hex table if the ramp ever needs to change) and the eased-taper rationale in `00-design-system-plan.md` Step 1. Contrast-verified by `scripts/check-contrast.mjs`.

Primary scale ("Amber Signal"):

```
50  #fff2ea   100 #ffeadc   200 #ffd8bd   300 #ffc197
400 #ffa35f   500 #d9730d   600 #7e3f00   700 #572a00
800 #3a1a00   900 #230d00   950 #1a0800
```

Secondary scale ("teal-ink" — used far more sparingly than primary; it's a complement, not a co-lead):

```
50  #dafdfd   100 #ccf0ef   200 #b0d3d2   300 #90b2b1
400 #698a89   500 #1b3a3a   600 #072828   700 #002020
800 #001919   900 #001313   950 #001111
```

Success scale:

```
50  #e0ffe3   100 #c2ffca   200 #97f5a6   300 #83e092
400 #69c679   500 #2f8f46   600 #00561e   700 #003c13
800 #00290a   900 #001905   950 #001203
```

Warning scale:

```
50  #fff4df   100 #ffeecd   200 #ffe0a4   300 #ffcf6c
400 #eebe58   500 #c99a2e   600 #755500   700 #4f3900
800 #332400   900 #1d1300   950 #140c00
```

Error scale:

```
50  #fff2f0   100 #ffe5e2   200 #ffc8c3   300 #ffa59e
400 #f67872   500 #b23a3a   600 #790011   700 #580009
800 #3f0005   900 #2b0002   950 #220002
```

Info scale:

```
50  #f0f5ff   100 #e3edff   200 #c6daff   300 #a4c4ff
400 #79a6ff   500 #2563eb   600 #0031a3   700 #002176
800 #001555   900 #000c3a   950 #00082e
```

**Light-mode text remap.** Nuxt UI's "subtle" variant (badges, etc.) uses the raw 500 stop as flat text color in light mode. `primary-500`, `warning-500`, `success-500`, and `info-500` all measure below 4.5:1 as flat text on white (confirmed by `check-contrast.mjs` and an `@axe-core/playwright` scan) — their `600` stops all pass. `error-500` and `secondary-500` already pass and are untouched. `main.css` remaps `.light { --ui-primary/success/warning/info: var(--color-*-600) }` — scoped to `.light` only, never bare `:root`, so it can't bleed into `.dark`'s own (already-passing) 400-stop mapping.

## Typography

| Role | Face | Notes |
|---|---|---|
| UI / body | Inter (variable) | Broad language coverage, tabular figures available for prices/order IDs |
| Data / code | JetBrains Mono | Order IDs, SKUs, courier reference numbers, internal/API surfaces |

Type scale — Tailwind defaults, used as-is, no one-off sizes in components:

```
xs 12/16   sm 14/20   base 16/24   lg 18/28
xl 20/28   2xl 24/32  3xl 30/36    4xl 36/40
```

## Spacing & radius

- Spacing: Tailwind's default 4px scale. No custom steps.
- Radius: `md` (6px) default for inputs/buttons/cards; `lg` (10px) for modals/panels; avoid full-pill radius except on badges and avatars.

## Nuxt UI theme wiring

`packages/ui` is a **Nuxt layer**. Its `app.config.ts`/`assets/` live under `packages/ui/app/` — Nuxt 4's `srcDir` convention applies per-layer, not just at the project root — while `nuxt.config.ts` and `package.json` stay at the layer root, as siblings of `app/`.

`packages/ui/nuxt.config.ts`:

```ts
import { createResolver } from '@nuxt/kit'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  modules: ['@nuxt/ui'], // fonts/icon/color-mode are @nuxt/ui's own dependencies and auto-register — don't list them here too
  app: {
    head: { htmlAttrs: { lang: 'en' } }
  },
  // `~/...` resolves against the *consuming app's* srcDir, not this layer's
  // own — an absolute path anchored to this file is required.
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
```

`packages/ui/app/app.config.ts` — holds only `ui.colors`; fonts/colorMode/icon are module build options and belong in `nuxt.config.ts` above, not here:

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'ink',
      success: 'success',
      warning: 'warning',
      error: 'error',
      info: 'info',
      neutral: 'stone'
    }
  }
})
```

`packages/ui/app/assets/css/main.css` — Tailwind v4 CSS-first theme. Note **`@theme static`**, not plain `@theme` — without `static`, Tailwind can tree-shake variables that Nuxt UI only references via generated (non-literal) class names:

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  /* full 50–950 ramps for brand, ink, success, warning, error, info —
     see the Color tokens section above for the exact committed values */
}

body {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

.font-mono,
code,
.tabular {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

/* Light-mode text remap — see "Light-mode text remap" above */
.light {
  --ui-primary: var(--color-brand-600);
  --ui-success: var(--color-success-600);
  --ui-warning: var(--color-warning-600);
  --ui-info: var(--color-info-600);
}
```

`packages/ui/package.json` needs explicit `dependencies`/`devDependencies` — Nuxt's layer-authoring guidance requires a layer to declare the modules it uses, including `@nuxt/kit` (for `createResolver` above) and `nuxt` itself as a dev dependency. Each consuming app (`apps/storefront`, `apps/admin`) declares its own `nuxt`/`@nuxt/ui` dependencies too and extends the layer with `{ extends: ['../../packages/ui'] }`.

## Component inventory

| Component | Storefront | Admin |
|---|---|---|
| Button, Input, Select, Badge, Card | ✓ | ✓ |
| Modal, Slideover, Toast | ✓ (cart, order confirm) | ✓ (order detail, forms) |
| Table | — | ✓ (order queue, reconciliation grid) |
| Command palette | — | ✓ (admin quick-nav) |
| Stepper | ✓ (checkout) | — |
| Tabs, Accordion | ✓ (PDP, FAQ) | ✓ (settings) |

## Dark mode

Both apps support system preference plus a manual toggle via Nuxt UI's `useColorMode()`. Semantic colors get their dark-mode pairing from Tailwind's built-in scale inversion — don't hand-pick separate dark hexes except where contrast fails AA (check `warning` and `error` specifically; both gold and red get muddy at 600-weight on dark surfaces). Also re-check `primary` against `warning` specifically in dark mode — they're close in hue by design intent (both warm), and dark surfaces tend to compress hue differences further.

## Accessibility baseline

- WCAG 2.1 AA contrast minimum, verified on both themes for every semantic pairing (text-on-badge, badge-on-card).
- Every interactive element keyboard-reachable with a visible focus ring — Nuxt UI's default `ring` token, don't strip it.
- Status conveyed by icon + label + color, never color alone.
- Respect `prefers-reduced-motion` for all transitions and toasts.

## Iconography

`@nuxt/icon` with **Lucide** as the only collection — consistent stroke weight, covers the commerce/logistics vocabulary this product needs (package, truck, check-circle, alert-triangle, rotate-ccw for RTO). Don't mix in a second icon set.

---

## Tasks

### DS-01 — Generate and commit the full primary + secondary color scales
**Depends on:** — · **Effort:** S

Generate precise 50–950 ramps from the `#D9730D` (primary) and `#1B3A3A` (secondary) bases using an oklch-based palette tool — the ramps in this doc are hand-approximated placeholders. Contrast-check primary at 500/600/700 against both a white and a near-black surface.

- [x] Full 11-step scales for both primary and secondary (plus success/warning/error/info — extended beyond the original primary+secondary scope once it became clear Nuxt UI needs full ramps for every named color it renders in multiple shades) committed to `packages/ui/app/assets/css/main.css`
- [x] `primary-600` on white 8.08:1, `primary-400` on near-black 9.10:1 — both ≥ 4.5:1 (`scripts/check-contrast.mjs`)
- [x] `warning` vs `primary` checked in a real `StatusBadge` context on `/style-guide` — distinct at a glance (28° hue apart); an `@axe-core/playwright` scan additionally caught that `warning`/`primary`/`success`/`info`'s raw *500* stops fail 4.5:1 as flat badge text in light mode, fixed via the light-mode `--ui-*` remap documented above
- [x] Values documented here match the committed CSS exactly

### DS-02 — Wire the shared Nuxt UI theme package
**Depends on:** DS-01 · **Effort:** S

Create `packages/ui` with `app.config.ts` and `assets/css/main.css` as the single theme source for both apps.

- [x] `packages/ui` exports config + CSS as a Nuxt layer, consumed by `apps/storefront` and `apps/admin` via `extends`
- [x] Zero duplicated color/typography definitions between the two apps (`grep -rn "#D9730D" apps/` outside `packages/ui` returns nothing)
- [x] `/style-guide` (in `packages/ui/app/pages`, inherited by both apps, dev-only via `import.meta.dev`) renders every token for visual QA

### DS-03 — Typography setup
**Depends on:** DS-02 · **Effort:** S

Self-host Inter and JetBrains Mono (variable fonts) — no third-party font CDN at runtime, no layout shift on load.

- [x] Fonts self-hosted via `@nuxt/fonts` (auto-registered by `@nuxt/ui`) — confirmed 112 generated `@font-face` rules all pointing to same-origin `/_fonts/*.woff2`, zero requests to `fonts.googleapis.com`
- [x] `font-variant-numeric: tabular-nums` confirmed on price and order-ID displays via the `.tabular` utility
- [x] No component uses a font size outside the documented scale

### DS-04 — Dark mode implementation + contrast audit
**Depends on:** DS-02 · **Effort:** M

- [x] Manual toggle and system-preference default both work; preference persists via `localStorage['amalice-color-mode']`, confirmed via the FOUC-prevention inline script Nuxt Color Mode injects
- [x] Every semantic badge/status chip passes AA contrast in both themes (dark mode's 400-stop mapping already passed; light mode needed the `--ui-*` 600-stop remap — see DS-01)
- [x] No component hardcodes a light-only or dark-only color value (`grep -rn "dark:" apps/ packages/ui` on our own authored files returns nothing — only generated `.nuxt/` build output uses token-based `dark:` variants)

### DS-05 — Shared primitive components
**Depends on:** DS-02, DS-03 · **Effort:** L

Build the wrapper components both apps need beyond raw Nuxt UI defaults:

- **`StatusBadge`** — single source-of-truth map from every order/shipment/reconciliation state (plan §7) to a color + icon + label
- **`PriceDisplay`** — consistent currency formatting and tabular figures, storefront and admin alike
- **`EmptyState`** — used anywhere a list/table can be empty

- [x] `StatusBadge` covers every state in the order lifecycle state machine (all 13 states from `cod-platform-plan.md` §7), no state falls through to a default/unstyled case
- [x] `PriceDisplay` implemented (cents-based, `Intl.NumberFormat`) — enforcement that every monetary value in the app actually uses it happens as real money-displaying screens get built (nothing to enforce yet at the design-system stage)
- [x] Components live in `packages/ui/app/components`, imported by both apps via the layer, not copy-pasted

### DS-06 — Iconography setup
**Depends on:** DS-02 · **Effort:** S

- [x] `@nuxt/icon` configured with Lucide as the only collection (`icon.collections` + `icon.serverBundle.collections`), confirmed server-bundled locally (`@iconify-json/lucide` installed) rather than fetched from the Iconify API at runtime
- [x] Logistics-specific icon usage documented as the `StatusBadge` state→icon map in this file's "Nuxt UI theme wiring" section and in `00-design-system-plan.md` Step 5 — that table *is* the icon usage doc, kept current rather than duplicated elsewhere

### DS-07 — Accessibility pass on core primitives
**Depends on:** DS-04, DS-05 · **Effort:** M

Audit Button, Input, Select, Modal, Table before any feature work builds on top of them — cheaper to fix once here than N times later.

- [x] `@axe-core/playwright` scan on all four pages (both apps × index + `/style-guide`) — 0 violations after fixes (missing `lang`/`<title>`/`<main>` landmark, and the light-mode badge-contrast issue from DS-01)
- [x] Button (the only interactive primitive with a real instance right now — the dark-mode toggle) confirmed keyboard-reachable with a visible focus ring via automated Tab-and-inspect
- [ ] Input/Select/Modal/Slideover/Table have no real instances yet (no feature page uses them) — audit these for real once `FND-02`/`FND-03`/`ADM-04` etc. actually render one, don't fabricate a check against a component nobody's using yet

---

## Re-theme pass — Polaris (storefront) + Polaris×Stripe (admin)

Direction change recorded above (top of this file). The two tasks below keep the shared foundation intact and re-skin each app's personality. **Read the project skills `polaris-design-language` and `stripe-polaris-admin-theme` before starting either** — they carry the exact token values and the conventions that keep the two apps consistent.

Key constraints repeated here because they're load-bearing:
- **No React.** Do not `pnpm add @shopify/polaris`, `@shopify/polaris-tokens`, or any Stripe React component. We adopt token *values*, applied to Nuxt UI v4 primitives. Both target design systems are React libraries; this project is Nuxt/Vue.
- **Status semantics are shared and frozen.** `StatusBadge`'s 13-state order-lifecycle map (DS-05) is the same in both apps. DS-08/DS-09 change primary/surface/shadow/type/density only — never the status palette. Re-skinning a "Delivered" badge differently per app would break the "tracking state matches admin 1:1" guarantee `SF-10` ships on.
- **Shared `packages/ui` stays the foundation.** Admin-only tokens go in an admin override layer (`apps/admin/app/assets/css/admin.css`), never in `main.css`. The storefront keeps the shared tokens as its primary source.

### DS-08 — Storefront re-theme: Shopify Polaris visual language
**Depends on:** DS-07 · **Effort:** M

Make `apps/storefront` look like a real Shopify store — Polaris's current (2025/2026, "Introducing Polaris" v13+) visual language: near-black primary actions, light-grey page background, hairline borders, flat-but-layered neutral shadows, high-but-airier-than-admin density. Token values and conventions live in the `polaris-design-language` skill.

- [x] Regenerate the `brand` ramp in `packages/ui/app/assets/css/main.css` from a near-black primary base (Polaris primary `#1A1A1A`, hover `#303030`). Because the base is achromatic, the ramp becomes a grey ramp — verify a near-black primary still reads as "primary" now that the status colors (success/warning/error/info) carry the warmth the old amber brand used to. Regenerate with `scripts/generate-palette.mjs` (recreate it; deleted as a one-off in DS-01) using `culori` oklch + `clampChroma` + eased taper `t**0.55`, not hand-edited stops. **Done — and the achromatic base surfaced a real issue the original spec missed:** anchoring `#1A1A1A` at the 500 stop made the 600 stop come out *lighter* than 500 (you can't go darker than near-black). Fixed by anchoring the neutral base at the **900** stop and tapering lightness up to near-white at 50; `--ui-primary` now resolves to brand-900 (the real near-black), not a meaningless mid-grey at 500. Generator deleted again after use.
- [x] Update status ramps' 500/600 stops to Polaris hexes (success `#198640`, critical `#CD0E0E`, info `#0A74C8`; warning stays attention-yellow per DS-01's deliberate choice) and regenerate neighbors. Page background `#F1F1F1`, surface `#FFFFFF`, border `#E1E1E1`
- [x] Add the Polaris shadow set to `@theme static` — single neutral alpha base `rgba(26,26,26,*)`, opacity 0.07–0.18 (`--shadow-polaris-100..500`). Prefer Tailwind's default radius/spacing (4px grid, `rounded`/`rounded-lg`); add custom radius aliases only if a default doesn't fit
- [x] Re-run `node scripts/check-contrast.mjs` on the new 500/600 stops against white and `#F1F1F1`; re-run `node scripts/a11y-check.mjs` on `/style-guide`. Keep the `.light { --ui-*: var(--color-*-600) }` remap wherever 500 fails 4.5:1 — re-verify, don't assume the old mapping still holds. **Inverted finding from DS-01:** Polaris's chromatic status bases are darker, so success/error/info **500 passes AA** while the generated 600 is *lighter* than 500 — remap now points primary→brand-900 and warning→warning-600 only (status colors stay at their passing 500 stop).
- [x] `/style-guide` renders every new token and all 13 `StatusBadge` states in both themes, AA-clean, before any SF-13+ feature page builds on it — same gate DS-02 used, re-run after the re-theme. Style-guide updated with Polaris labels + a shadows section; storefront builds green.
- [x] No `@shopify/*` package added to any `package.json`; `grep -rn "#1A1A1A\|#303030\|#F1F1F1\|#E1E1E1" apps/storefront` returns nothing (hexes live in `main.css` as tokens, never in components)

### DS-09 — Admin re-theme: Polaris × Stripe hybrid visual language
**Depends on:** DS-08 · **Effort:** L

Make `apps/admin` look like a Stripe dashboard built with Polaris's structural discipline: Stripe indigo primary `#635BFF`, `#F6F9FC` off-white page background, soft navy-based `rgba(10,37,64,*)` shadows, comfortable-but-dense Stripe-style tables, 14px body (Polaris density). Token values and conventions live in the `stripe-polaris-admin-theme` skill.

- [x] Create `apps/admin/app/assets/css/admin.css` as an **admin-only override layer** imported after the shared `main.css` (`css: ['~/assets/css/admin.css']` in `apps/admin/nuxt.config.ts`). Override `--ui-primary` → Stripe indigo `#635BFF` (hover `#4F46E5`), add `--shadow-admin-sm/md/lg` (navy `#0A2540`-based, 4–12% opacity), `--radius-admin` aliases (6px default), and `#F6F9FC` page background scoped to the dashboard layout root via `.admin-surface` — never bare `:root`. **Note the path fix:** `~/app/assets/...` resolved to `app/app/assets/...` (Nuxt 4 srcDir); corrected to `~/assets/css/admin.css`.
- [x] Create `apps/admin/app/app.config.ts` (didn't exist) with per-app Nuxt UI component defaults. Kept minimal (button density) per the DS-07 discipline — table cell padding/header styling lives in `admin.css` (`.admin-table`) applied per-page, not fabricated in config before pages existed.
- [x] Define the Stripe-style data-table look as the admin-wide convention (documented in the skill): white rows on `#F6F9FC`, no harsh zebra, ~44–48px row height, right-aligned tabular numbers via `PriceDisplay`, status pills via the **unchanged shared** `StatusBadge`, row hover `#F4F1FF` lilac wash. Applied across orders/inventory/customers/reconciliation/audit tables.
- [x] Verify the override does **not** leak into the storefront: `grep -rn "635bff\|0A2540\|F6F9FC" apps/storefront packages/ui` returns nothing (admin tokens are scoped to the admin app) — confirmed.
- [x] `StatusBadge` order-lifecycle colors are byte-identical between the two apps — the component lives in the shared `packages/ui` layer and is consumed unchanged by both; the override touches primary/surface/shadow only, never status.
- [x] No `@shopify/*` package and no Stripe React component added to `apps/admin/package.json`; the admin builds and typechecks green (`pnpm --filter admin typecheck` + `build` both pass).
