# Design System — Execution Plan

A runbook for `00-design-system.md`. That file defines *what* the design system is (tokens, rationale) and *what done looks like* (DS-01–DS-09 acceptance criteria); this file is *how to actually build it*, in order, with real commands and file contents. Follow it top to bottom — later steps assume earlier ones landed.

**Owner note:** Steps 0–7 (DS-01–DS-07) are implemented end-to-end and verified working (dev server boots, `/style-guide` renders, contrast + accessibility scans pass). **Steps 8–9 (DS-08/DS-09) are the re-theme pass** — the project moved from the single "Amber Signal" theme to Polaris (storefront) + Polaris×Stripe (admin). They are new work, not yet implemented. See **"Implementation notes"** at the end for every place reality diverged from the original DS-01–DS-07 plan.

---

## Step 0 — Minimum workspace scaffold (prerequisite, not a DS task)

Needed only so `packages/ui` has somewhere to live and something to be consumed by. This is the smallest possible slice of `FND-01`, not a replacement for it.

```bash
pnpm init -w
mkdir -p packages/ui/app/assets/css packages/ui/app/components
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json` (root) — add:
```json
{
  "private": true,
  "engines": { "node": ">=24" },
  "packageManager": "pnpm@9"
}
```

---

## Step 1 — DS-01: Generate and commit the color scales

The hex ramps in `00-design-system.md` are hand-approximated. Generate the real ones with an oklch-based ramp so lightness steps are perceptually even, not just numerically even.

```bash
pnpm add -D -w culori
```

`scripts/generate-palette.mjs`:
```js
import { formatHex, oklch, interpolate, samples } from 'culori'

// One ramp per brand base color. Steps chosen to land the *base* hex
// at the 500 stop, matching the tokens table in 00-design-system.md.
const bases = {
  brand: '#D9730D', // primary — Amber Signal
  ink:   '#1B3A3A'  // secondary — teal-ink
}

const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

for (const [name, base] of Object.entries(bases)) {
  const c = oklch(base)
  console.log(`\n--color-${name} ramp (base ${base}):`)
  for (const stop of stops) {
    // Push lightness toward 0.98 at the light end and 0.12 at the dark end,
    // keep chroma/hue anchored to the base color.
    const t = 1 - stop / 950
    const l = stop === 500 ? c.l : 0.12 + t * (0.98 - 0.12)
    const shade = formatHex({ mode: 'oklch', l, c: c.c, h: c.h })
    console.log(`  --color-${name}-${stop}: ${shade};`)
  }
}
```

```bash
node scripts/generate-palette.mjs
```

Paste the output into `packages/ui/app/assets/css/main.css` (Step 2), replacing the hand-approximated values. Then delete `scripts/generate-palette.mjs` — it's a one-off, not a build step.

**Contrast check** — run this against the generated values before committing:

```bash
pnpm add -D -w wcag-contrast
```

```js
// scripts/check-contrast.mjs
import { hex } from 'wcag-contrast'

const pairs = [
  ['#B85E09' /* primary-600 */, '#FFFFFF', 4.5],
  ['#E28A22' /* primary-400 */, '#12181A', 4.5], // near-black surface from the plan doc's dark theme
]

for (const [fg, bg, min] of pairs) {
  const ratio = hex(fg, bg)
  console.log(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 (need ≥ ${min})`, ratio >= min ? 'PASS' : 'FAIL')
}
```

- [ ] Both pairs pass; if `primary-600` on white fails, regenerate with a slightly lower lightness at the 600 stop and re-check — don't hand-nudge the hex directly, re-run the script so the whole ramp stays consistent
- [ ] Open `warning` (`#C99A2E`) and `primary` (`#D9730D`) side by side as two `StatusBadge`-shaped rectangles (build this quickly in the style guide from Step 2, don't judge from raw swatches) — confirm a person glancing at a table for two seconds can tell them apart

---

## Step 2 — DS-02: Wire the shared theme as a Nuxt layer

`packages/ui` is a **Nuxt layer** — the standard mechanism for sharing `app.config.ts`, CSS, and components across multiple Nuxt apps without a build step of its own.

`packages/ui/package.json`:
```json
{
  "name": "@amalice/ui",
  "version": "0.0.0",
  "type": "module",
  "main": "./nuxt.config.ts"
}
```

`packages/ui/nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/fonts', '@nuxt/icon'],
  css: ['~/assets/css/main.css']
})
```

`packages/ui/app/app.config.ts`:
```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'ink',
      neutral: 'stone'
    }
  }
})
```

`packages/ui/app/assets/css/main.css` — paste the Step 1 output into the `@theme` block (full content already drafted in `00-design-system.md`; this is the file it belongs in).

Each consuming app then does one line of work:

`apps/storefront/nuxt.config.ts` / `apps/admin/nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  extends: ['../../packages/ui']
})
```

- [ ] `pnpm --filter @amalice/ui install` resolves cleanly
- [ ] Both apps inherit the theme with zero duplicated color/typography config — verify by grepping for `#D9730D` outside `packages/ui`; it should not appear
- [ ] Style guide route: add `packages/ui/app/pages/style-guide.vue` (inherited by both apps automatically via the layer) rendering every color stop as a swatch, the type scale, and every semantic badge — guard it out of production with `if (import.meta.dev)` in the page or exclude via `routeRules` in each app's own config if it must never ship

---

## Step 3 — DS-03: Typography

`@nuxt/fonts` is already a module in `packages/ui/nuxt.config.ts` from Step 2 — it self-hosts by default (downloads and serves locally at build time), which satisfies "no third-party font CDN at runtime" with zero extra config.

`packages/ui/app/app.config.ts` — extend:
```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'brand', secondary: 'ink', neutral: 'stone' }
  },
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', variable: true },
      { name: 'JetBrains Mono', provider: 'google', variable: true }
    ]
  }
})
```

`packages/ui/app/assets/css/main.css` — add below the `@theme` block:
```css
body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
.font-mono, code, .tabular {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
```

- [ ] `pnpm dev` on either app, check Network tab: font files load from the app's own origin, not `fonts.googleapis.com` or similar
- [ ] Price and order-ID displays in the style guide page use `.tabular` and visibly align digit columns
- [ ] No component in either app sets `font-size` outside the documented scale — quick grep for raw `px` font-size declarations as a sanity check

---

## Step 4 — DS-04: Dark mode

Nuxt UI ships `@nuxtjs/color-mode` as a dependency already; no separate install.

`packages/ui/app/app.config.ts` — extend:
```ts
export default defineAppConfig({
  // ...
  colorMode: {
    preference: 'system',
    fallback: 'light',
    storageKey: 'amalice-color-mode'
  }
})
```

Add a toggle to the style guide page using `useColorMode()`:
```vue
<script setup lang="ts">
const colorMode = useColorMode()
</script>
<template>
  <UButton
    :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
    @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
  />
</template>
```

- [ ] Toggle flips the theme instantly, reload preserves the choice (check `localStorage['amalice-color-mode']`)
- [ ] Re-run the Step 1 contrast script against the dark-surface pairing for `warning`, `error`, and `primary` — this is the audit called out explicitly in `00-design-system.md`'s Dark Mode section
- [ ] `grep -rn "dark:" apps/ packages/ui` — every hit should be a Tailwind dark-variant utility referencing a token, never a hardcoded hex

---

## Step 5 — DS-05: Shared primitive components

Three components, in this order (`StatusBadge` first — it encodes the order lifecycle from `cod-platform-plan.md` §7, so get the state map right before building anything on top of it).

**`packages/ui/app/components/StatusBadge.vue`** — status → token/icon/label map, one source of truth:

| Lifecycle state | Token | Icon (Lucide) | Label |
|---|---|---|---|
| `PendingOTP` | `warning` | `clock` | Awaiting verification |
| `Cancelled` | `neutral` | `x-circle` | Cancelled |
| `Confirmed` | `info` | `check` | Confirmed |
| `Packed` | `info` | `package` | Packed |
| `HandedToCourier` | `info` | `truck` | With courier |
| `OutForDelivery` | `info` | `truck` | Out for delivery |
| `DeliveryFailed` | `warning` | `alert-triangle` | Delivery attempt failed |
| `Delivered` | `success` | `check-circle` | Delivered |
| `ReturnedToOrigin` | `error` | `rotate-ccw` | Returned to origin |
| `Restocked` | `neutral` | `package-check` | Restocked |
| `CashCollected` | `success` | `banknote` | Cash collected |
| `Reconciled` | `success` | `check-circle` | Reconciled |
| `Settled` | `success` | `badge-check` | Settled |

```vue
<script setup lang="ts">
type OrderState =
  | 'PendingOTP' | 'Cancelled' | 'Confirmed' | 'Packed' | 'HandedToCourier'
  | 'OutForDelivery' | 'DeliveryFailed' | 'Delivered' | 'ReturnedToOrigin'
  | 'Restocked' | 'CashCollected' | 'Reconciled' | 'Settled'

const STATE_MAP: Record<OrderState, { color: string; icon: string; label: string }> = {
  PendingOTP:       { color: 'warning', icon: 'i-lucide-clock',          label: 'Awaiting verification' },
  Cancelled:        { color: 'neutral', icon: 'i-lucide-x-circle',       label: 'Cancelled' },
  Confirmed:        { color: 'info',    icon: 'i-lucide-check',         label: 'Confirmed' },
  Packed:           { color: 'info',    icon: 'i-lucide-package',       label: 'Packed' },
  HandedToCourier:  { color: 'info',    icon: 'i-lucide-truck',         label: 'With courier' },
  OutForDelivery:   { color: 'info',    icon: 'i-lucide-truck',         label: 'Out for delivery' },
  DeliveryFailed:   { color: 'warning', icon: 'i-lucide-alert-triangle',label: 'Delivery attempt failed' },
  Delivered:        { color: 'success', icon: 'i-lucide-check-circle',  label: 'Delivered' },
  ReturnedToOrigin: { color: 'error',   icon: 'i-lucide-rotate-ccw',    label: 'Returned to origin' },
  Restocked:        { color: 'neutral', icon: 'i-lucide-package-check', label: 'Restocked' },
  CashCollected:    { color: 'success', icon: 'i-lucide-banknote',      label: 'Cash collected' },
  Reconciled:       { color: 'success', icon: 'i-lucide-check-circle',  label: 'Reconciled' },
  Settled:          { color: 'success', icon: 'i-lucide-badge-check',   label: 'Settled' }
}

const props = defineProps<{ state: OrderState }>()
const meta = computed(() => STATE_MAP[props.state])
</script>

<template>
  <UBadge :color="meta.color" variant="subtle" :icon="meta.icon">
    {{ meta.label }}
  </UBadge>
</template>
```

**`packages/ui/app/components/PriceDisplay.vue`** — currency formatting, tabular figures:
```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{ amountCents: number; currency?: string }>(), {
  currency: 'USD' // swap to the real target-market currency before launch — placeholder only
})
const formatted = computed(() =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: props.currency })
    .format(props.amountCents / 100)
)
</script>
<template><span class="tabular">{{ formatted }}</span></template>
```

**`packages/ui/app/components/EmptyState.vue`** — icon + message + optional action slot:
```vue
<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>
<template>
  <div class="flex flex-col items-center gap-2 py-12 text-center text-neutral-500">
    <UIcon :name="icon ?? 'i-lucide-inbox'" class="size-8" />
    <p class="font-medium text-neutral-700 dark:text-neutral-300">{{ title }}</p>
    <p v-if="description" class="text-sm">{{ description }}</p>
    <slot />
  </div>
</template>
```

- [ ] `StatusBadge` table above has a row for every state in `cod-platform-plan.md` §7 — cross-check before marking done, this list is the actual acceptance bar
- [ ] `PriceDisplay` takes cents (integers), not floats — avoids float rounding bugs in money math; flag this convention in `packages/shared`'s Order schema (`FND-05`) so API and UI agree on units
- [ ] Add all three to the style guide page with representative states/values

---

## Step 6 — DS-06: Iconography

Already installed as a module in Step 2. Just configure the default collection:

`packages/ui/nuxt.config.ts` — extend:
```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/fonts', '@nuxt/icon'],
  icon: {
    collections: ['lucide'] // only pull this one collection into the bundle
  },
  css: ['~/assets/css/main.css']
})
```

- [ ] Confirm build output only bundles `lucide` icons actually referenced (`@nuxt/icon` tree-shakes by default — verify by checking the built chunk doesn't include a full icon-set JSON)
- [ ] The `StatusBadge` icon table from Step 5 *is* the "documented logistics icon usage" this task's acceptance criteria asks for — no separate doc needed, just keep that table current

---

## Step 7 — DS-07: Accessibility pass

```bash
pnpm add -D -w @axe-core/playwright playwright
```

Minimal audit script against the style guide route (requires `pnpm dev` running):

```js
// scripts/a11y-check.mjs
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:3000/style-guide')
const results = await new AxeBuilder({ page }).analyze()
console.log(`${results.violations.length} violations`)
for (const v of results.violations) console.log(`- [${v.impact}] ${v.id}: ${v.help}`)
await browser.close()
```

```bash
node scripts/a11y-check.mjs
```

Then manual keyboard-only pass (automated tools miss most of this):

- [ ] Tab through Button, Input, Select, Modal trigger, Table header sort controls — every stop shows a visible focus ring, tab order matches visual order
- [ ] Open a Modal/Slideover with the mouse, then use only the keyboard: focus is trapped inside, `Esc` closes it, and focus returns to the element that opened it
- [ ] Screen reader spot-check (VoiceOver/NVDA) on the Table: column headers announce correctly when navigating cells
- [ ] `node scripts/a11y-check.mjs` returns 0 `critical`/`serious` violations on the style guide route

---

## Definition of done

`packages/ui` exists as a Nuxt layer, both apps extend it, and:

- [x] Every checkbox in Steps 1–7 above is checked (with the corrections noted below applied)
- [x] Every checkbox in `00-design-system.md`'s DS-01–DS-07 is checked, except Input/Select/Modal/Table's a11y audit, explicitly deferred until those components have a real instance to audit
- [x] `/style-guide` renders the full palette, type scale, `StatusBadge`/`PriceDisplay`/`EmptyState`, and a dark-mode toggle — kept in the repo permanently as a dev-only route
- [x] `FND-02`/`FND-03` can start immediately — `packages/ui` is ready to be extended

## Rough sequencing

Steps 1–2 are a hard sequential dependency for everything else. 3, 4, and 6 can run in parallel once 2 lands. 5 needs 2 and 3 (fonts) done first. 7 runs last, against the finished set. Total: roughly a week for one developer, 3–4 days if 3/4/6 are split across two people. (In practice, one focused implementation pass got through all of it in a single session — the estimate above assumes a team ramping up on the stack for the first time.)

---

## Step 8 — DS-08: Storefront re-theme (Polaris)

Direction change (2026-07): the storefront adopts Shopify Polaris's current visual language. **Not** via Polaris's React components — via token values applied to the existing Nuxt UI v4 layer. The project skill `polaris-design-language` carries the full token table and conventions; read it before starting. This step is *how* to execute DS-08 mechanically.

### 8.1 — Recreate the palette generator

`scripts/generate-palette.mjs` was deleted after DS-01 (one-off). Recreate it with the new Polaris bases — full ramps for `brand` (achromatic, from `#1A1A1A`) plus the status families:

```js
// scripts/generate-palette.mjs  — recreate, same shape as DS-01's original
import { formatHex, oklch, clampChroma } from 'culori'

// Polaris (2025/2026 "Introducing Polaris") bases. brand is achromatic → grey ramp.
const bases = {
  brand:   '#1A1A1A', // primary action (near-black), hover #303030
  success: '#198640', // status — Delivered/Reconciled/Settled/in-stock
  error:   '#CD0E0E', // critical — DeliveryFailed/RTO/out-of-stock
  info:    '#0A74C8'  // informational — Confirmed/Packed/With courier
  // warning stays the DS-01 gold (#C99A2E) — deliberately distinct from any primary
}
const stops = [50,100,200,300,400,500,600,700,800,900,950]

for (const [name, base] of Object.entries(bases)) {
  const c = oklch(base)
  console.log(`\n--color-${name} ramp (base ${base}):`)
  for (const stop of stops) {
    const t = 1 - stop/950
    const l = stop === 500 ? c.l : 0.12 + (t**0.55)*(0.98-0.12) // eased taper so 600/300 clear AA
    const shade = clampChroma({ mode:'oklch', l, c:c.c, h:c.h }, 'oklch', 'rgb')
    console.log(`  --color-${name}-${stop}: ${formatHex(shade)};`)
  }
}
```

```bash
pnpm add -D -w culori        # already a devDep from DS-01; confirm
node scripts/generate-palette.mjs
```

Paste the output into `packages/ui/app/assets/css/main.css`'s `@theme static` block, replacing the old amber `brand` ramp and the old status ramps' stops. **Do not hand-nudge individual hexes** — regenerate the whole ramp so lightness stays perceptually even. Then delete `scripts/generate-palette.mjs` again (one-off).

- [ ] Run completes; ramps paste cleanly; `warning` ramp left untouched (gold, per DS-01)

### 8.2 — Contrast re-check + light-mode remap

The achromatic brand ramp changes which stops pass AA. Re-verify rather than assuming the DS-01 mapping still holds.

```bash
node scripts/check-contrast.mjs   # update the pairs array inside it to the new 500/600 stops + #F1F1F1 page bg
node scripts/a11y-check.mjs        # against /style-guide on the storefront
```

- [ ] Every `primary`/`success`/`warning`/`info` 500-vs-600 decision re-checked on white **and** `#F1F1F1`; `.light { --ui-*: var(--color-*-600) }` remap kept only where 500 fails 4.5:1 (update the comment in `main.css` to reflect what's actually remapped now — the achromatic brand may pass at 500 where the old amber didn't)
- [ ] `0 critical/serious violations` from the axe scan on `/style-guide`, both themes

### 8.3 — Shadows + surfaces

Add the Polaris shadow set to `@theme static` in `main.css`. Single neutral alpha base, low opacity — the flat-but-layered signature:

```css
/* inside @theme static — Polaris elevation (neutral, low-opacity) */
--shadow-polaris-100: 0px 1px 0px 0px rgba(26,26,26,0.07);
--shadow-polaris-200: 0px 1px 0px 0px rgba(26,26,26,0.07), 0px 4px 8px -2px rgba(26,26,26,0.10);
--shadow-polaris-300: 0px 2px 4px -1px rgba(26,26,26,0.10), 0px 4px 8px -2px rgba(26,26,26,0.10);
--shadow-polaris-400: 0px 4px 8px -2px rgba(26,26,26,0.10), 0px 16px 24px -4px rgba(26,26,26,0.10);
--shadow-polaris-500: 0px 8px 28px -4px rgba(26,26,26,0.18);
```

Page background (`#F1F1F1`) and surface (`#FFFFFF`)/border (`#E1E1E1`) go on the storefront layout root / Nuxt UI `neutral` tuning — not as brand tokens. Prefer Tailwind's default radius; only add a radius alias if a Polaris value (4/8/12/16) has no Tailwind equivalent.

- [ ] New shadows render on `/style-guide` swatches; marketing cards and resting surfaces use `--shadow-polaris-100`; confirm the storefront layout root carries `#F1F1F1`

### 8.4 — Gate

`/style-guide` is the gate, same as DS-02. Before any SF-13+ page builds on the new theme:

- [ ] Every color swatch, type sample, `StatusBadge` (all 13 states), `PriceDisplay`, `EmptyState` renders AA-clean in **both** light and dark on `/style-guide`; the page is still dev-only (`import.meta.dev`)
- [ ] `grep -rn "@shopify" apps/ packages/` returns nothing; `grep -rn "#1A1A1A\|#303030\|#F1F1F1\|#E1E1E1" apps/storefront/app` returns nothing (hexes only in `main.css` as tokens)

---

## Step 9 — DS-09: Admin re-theme (Polaris × Stripe)

The admin keeps the shared foundation but layers a Stripe personality on top. Everything admin-specific lives in `apps/admin`, **never** in `packages/ui` — the storefront must not inherit Stripe indigo. The skill `stripe-polaris-admin-theme` has the full token table and conventions. This step is *how* to execute DS-09.

### 9.1 — Admin override CSS layer

Create the file, import it *after* the shared layer's `main.css`:

```css
/* apps/admin/app/assets/css/admin.css — Polaris×Stripe admin override layer.
   Imported after packages/ui's main.css so it wins on equal specificity.
   Scoped to the admin app only — never edit packages/ui for admin tokens. */

/* Stripe indigo replaces Polaris's near-black for primary ACTIONS (more clickable,
   more "SaaS dashboard"). Status semantics are NOT touched — StatusBadge is shared. */
--ui-primary: #635BFF;            /* Stripe indigo, hover #4F46E5 */
--ui-primary-hover: #4F46E5;

/* Stripe signature: off-white page bg, navy-based soft shadows, 6px radius default */
:root {
  --color-admin-bg: #F6F9FC;
  --shadow-admin-sm: 0 1px 2px rgba(10,37,64,.06), 0 1px 3px rgba(10,37,64,.04);
  --shadow-admin-md: 0 4px 10px rgba(10,37,64,.06), 0 2px 6px rgba(10,37,64,.05);
  --shadow-admin-lg: 0 10px 30px rgba(10,37,64,.10), 0 4px 12px rgba(10,37,64,.06);
  --radius-admin: 6px;
}
```

In `apps/admin/nuxt.config.ts`, add (note: the shared layer already injects `main.css`; this is additive):

```ts
export default defineNuxtConfig({
  // ...existing...
  css: ['~/app/assets/css/admin.css']
})
```

Apply the `#F6F9FC` page bg on the **dashboard layout root** (`apps/admin/app/layouts/default.vue`), not globally, so `/style-guide` (shared, inherits storefront look) stays neutral.

### 9.2 — Admin `app.config.ts` (per-app component defaults)

Create `apps/admin/app/app.config.ts` (doesn't exist yet) — Nuxt UI merges per-app `ui.*` defaults on top of the shared layer's:

```ts
export default defineAppConfig({
  ui: {
    table: {
      // Stripe-style: comfortable-but-dense, no harsh zebra, hairline separators
      td: 'px-4 py-3',                    // ~44–48px row height, 16px h-padding
      th: 'px-4 py-2.5 text-[#425466] text-xs font-medium',  // header 11–12px, weight 500
      // row hover (lilac wash) + separators handled via the slots/ClassData in each page,
      // not here — these are the shared defaults
    }
    // button/badge density tweaks land here as real admin pages reveal what's needed
  }
})
```

(Refine these defaults *as real admin pages get built* in ADM-04+ — don't fabricate table config for a table nobody renders yet, same discipline as DS-07's deferred Input/Select audit.)

### 9.3 — Stripe-style table convention

Encode once, reuse across order queue / reconciliation / inventory. Put a reusable cell-config pattern in the skill, and apply it per-page via `UTable`'s `ClassData`/slots rather than a shared wrapper component (Nuxt UI tables are config-driven; a wrapper tends to fight the API). Reference values: white rows on `#F6F9FC`, `#E3E8EE` 1px row separators, `#F4F1FF` hover, right-aligned tabular numbers via `PriceDisplay`, status via the unchanged `StatusBadge`, selected row = 2px indigo left border.

### 9.4 — Non-leak + identity gate

- [ ] `/style-guide` in **both** apps still passes the axe scan; storefront `/style-guide` shows *no* Stripe indigo, *no* `#F6F9FC` bg (those are admin-scoped)
- [ ] Side-by-side proof: render all 13 `StatusBadge` states on `/style-guide` in storefront vs admin — the badges are byte-identical (primary/surface/shadow differ; status does not). This is the guarantee `SF-10` (tracking) depends on
- [ ] `grep -rn "635BFF\|0A2540\|F6F9FC" apps/storefront packages/ui` returns nothing
- [ ] `pnpm --filter admin typecheck` green; `pnpm --filter admin build` green; no `@shopify/*` or Stripe React package in `apps/admin/package.json`

---

## Implementation notes — what changed once this actually got built

Fact-checking library APIs in advance (done before Step 0 started) caught most issues, but a few things only surfaced by actually running the commands:

- **`packages/ui/nuxt.config.ts`'s `css` path.** `~/assets/css/main.css` resolves against the *consuming app's* srcDir, not the layer's own — apps/storefront doesn't have that file, so it 404'd. Fixed with `@nuxt/kit`'s `createResolver(import.meta.url)` anchored to the layer file itself: `css: [resolve('./app/assets/css/main.css')]`. This requires `@nuxt/kit` as an explicit `packages/ui` dependency (pinned to the same version as `nuxt`), which wasn't in the original dependency list.
- **`import.meta.dev` in a template expression.** `v-if="import.meta.dev"` fails to compile — `import.meta` is module-only syntax and Vue template expressions compile as function bodies. Fixed by computing `const isDev = import.meta.dev` in `<script setup>` and referencing the plain variable in the template.
- **`@theme` → `@theme static`.** Confirmed necessary in practice, not just in docs — without `static`, color stops Nuxt UI only references via generated (non-literal) class names got tree-shaken.
- **Full ramps needed for all six colors, not just primary/secondary.** `success`/`warning`/`error`/`info` were originally left as single flat hexes on the assumption Nuxt UI's own defaults would carry them, but a custom-named `ui.colors.success` etc. needs its own full 50–950 scale the same way `primary`/`secondary` do — Nuxt UI's components (badges, buttons) use multiple shades per color, not just one. Extended `scripts/generate-palette.mjs` to cover all six from the start.
- **The generated ramp's chroma needs clamping, not just a lightness taper.** Holding the base color's chroma constant while sweeping lightness from near-white to near-black pushes the dark stops out of sRGB gamut, which clips to a muddy near-black-red regardless of the source hue. Fixed with `culori`'s `clampChroma(color, 'oklch', 'rgb')` per stop. A straight-line lightness taper also left some `600` stops (`warning-600` specifically) too light to hit 4.5:1 against white, since each color's base lightness differs a lot (warning's base is unusually light for a "500" position) — switched to an eased taper (`t ** 0.55`) so every color's `600`/`300` neighbors reliably clear contrast regardless of where `500` sits.
- **Nuxt UI's "subtle" badge variant uses the raw `500` stop as flat text color in light mode.** An `@axe-core/playwright` scan (not just the manual swatch-vs-swatch check the original DS-01 acceptance criteria asked for) caught that `primary`/`warning`/`success`/`info`-500 all fail 4.5:1 as flat text on a near-white `/10`-opacity badge background — a known general tradeoff for warm/light hues (real Tailwind palettes hit the same wall; e.g. `amber-500` on white). Fixed by remapping `.light { --ui-primary/success/warning/info: var(--color-*-600) }`, scoped to `.light` only (never bare `:root`) so it can't leak into `.dark`'s already-passing 400-stop mapping.
- **Style guide's own swatch labels had the same problem, one level down.** Overlaying the stop number on top of its own swatch color meant the *exact* 500 stop (by definition medium-lightness) had no single flat text color — white or black — that reliably hit 4.5:1. Fixed by moving labels below the color strip onto the page background instead of overlaying them, which is also just a more conventional way to label a palette swatch.
- **Missing `lang`, `<title>`, and a `<main>` landmark.** None of the scaffold pages had these; the axe scan flagged all three as serious/moderate. Added `app.head.htmlAttrs.lang: 'en'` in the shared layer, `useHead({ title })` per page, and wrapped page content in `<main>`.
- **`pnpm init -w`, `pnpm --filter @amalice/ui install`, and `npx playwright install chromium`.** The first two were invalid/meaningless as originally written (`-w` isn't an `init` flag; filtered-install-with-no-target does nothing useful) — replaced with `pnpm init` + hand-written `pnpm-workspace.yaml`, and a plain root `pnpm install`. The third was simply missing from the original runbook — `playwright`'s npm install doesn't fetch browser binaries on its own.
- **`@axe-core/playwright` needs `browser.newContext()`, not `browser.newPage()` directly** — the current version throws if you skip the explicit context.
- **Admin's `ssr: false` means `page.goto()` alone isn't enough for the a11y script** — the server sends an empty shell and content only exists after client-side hydration. Added `await page.waitForSelector('h1')` before running axe so the script works against both apps.
- **Nuxt DevTools injects its own floating panel** (`nuxt-devtools-frame`), which the axe scan flagged as content outside a landmark. It's dev-only tooling chrome, not part of the app, and absent from production builds — excluded from the scan (`.exclude('nuxt-devtools-frame')`) rather than "fixed."
