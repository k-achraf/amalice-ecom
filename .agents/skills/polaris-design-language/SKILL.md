---
name: polaris-design-language
description: Adopt Shopify Polaris's visual language in this project's Nuxt 4 + Nuxt UI v4 storefront WITHOUT using Polaris's React components. Use whenever re-theming, adding storefront pages, building marketing/collection/PDP UI, picking colors/spacing/radius for the storefront, or anyone mentions Polaris, Shopify admin look, or making the storefront look like a real Shopify store.
---

# Polaris design language (storefront)

How to make `apps/storefront` look like a real Shopify store — Polaris's visual language — while keeping the Nuxt 4 + Nuxt UI v4 + Tailwind v4 CSS-first component layer. **Do not reach for `@shopify/polaris` (React).** We adopt the *tokens and look*, not the React components; Nuxt UI's own primitives render the components.

This project's theming lives in `packages/ui` (a Nuxt layer both apps extend). Re-theming means editing tokens there, not styling components in the app. Read [`tasks/00-design-system.md`](../../../tasks/00-design-system.md) and [`tasks/00-design-system-plan.md`](../../../tasks/00-design-system-plan.md) for the full plan and the "why" behind each decision.

## When to use this skill

- Adding or editing any storefront page under `apps/storefront/app/pages/`
- Re-theming the storefront (colors, type, spacing, radius, shadows)
- Building store chrome: header, mega-menu, footer, announcement bar
- Choosing how a storefront component should look/space itself
- Anyone says "Polaris", "Shopify look", "make it a real store"

## The Polaris look (current, 2025/2026 — "Introducing Polaris" v13+)

Shopify's current design system moved away from the old navy sidebar. The signature is **high density, near-black primary actions, 4px grid, hairline borders, flat-but-layered shadows** — a restrained, editorial, almost monochrome aesthetic with semantic color used sparingly.

- **Primary action color = near-black `#1A1A1A`** (hover `#303030`), not indigo. If a stakeholder asks for "the navy", that's the *legacy* look — flag it rather than silently reverting.
- **Page background = `#F1F1F1`** light grey; **card surface = `#FFFFFF`**; **border = `#E1E1E1`** (1px hairlines).
- **Text:** primary `#1A1A1A`, secondary `#515155`.
- **Status (semantic, used as tint backgrounds + darker text, never color-only):** success `#198640` (bg `#EEFADO`), critical/destructive `#CD0E0E` (bg `#FFEAEA`), info blue `#0A74C8` (bg `#EAF3FC`).
- **Type:** Inter (already self-hosted here via `@nuxt/fonts`) + JetBrains Mono for IDs/SKUs (already wired). Polaris body = 16px; **admin density default = 14px** (storefront uses the larger 16px base).
- **Spacing:** 4px base (`100`=4, `200`=8, `300`=12, `400`=16, `500`=20, `600`=24, `800`=32, `1000`=40). Same grid Tailwind already uses — no custom steps.
- **Radius:** `100`=4px (inputs/buttons/cards default), `200`=8px (large cards/modals), `300`=12px, `400`=16px. Pill only on badges/avatars.
- **Shadows:** single neutral alpha base `rgba(26,26,26,*)`, low opacity (0.07–0.18). The key to Polaris's flat-but-layered look — never use pure black or heavy drop shadows.
- **Density rules:** tight 8–12px padding, 1px hairline borders, low-amplitude shadows, status = color + icon + label (never color alone — already enforced by our `StatusBadge`).

## Token mapping (Polaris → this project's tokens)

Polaris → our existing token names. Put new CSS custom properties under `packages/ui/app/assets/css/main.css`.

| Polaris token | Our token / where |
|---|---|
| primary `#1A1A1A` | `--color-brand-600` (set the brand ramp so 500/600 land near-black; keep the light `.light --ui-primary` remap from DS-01) |
| bg `#F1F1F1` | page bg — set on `<main>`/layout, not a brand token |
| surface `#FFFFFF`, border `#E1E1E1` | Nuxt UI `neutral` already maps to Tailwind `stone`; tune `--color-neutral-*` if the warm tone reads off |
| success/critical/info | replace the `--color-success/error/info` ramps' 500/600 stops with Polaris hexes; regenerate neighbors with `culori` |
| radius 4/8/12/16 | Tailwind defaults (`rounded`/`rounded-lg`/`rounded-xl`) already cover this — prefer defaults over custom |
| shadows `rgba(26,26,26,*)` | add a `--shadow-polaris-*` set in `@theme`; reference via `shadow-[var(--shadow-polaris-200)]` |

## How to re-theme (the DS-08 task)

This is the work in `tasks/00-design-system.md` → **DS-08 (storefront Polaris re-theme)**. Steps:

1. **Color ramps** — regenerate `brand`/`success`/`error`/`info` ramps in `packages/ui/app/assets/css/main.css` from new Polaris base hexes. **Do not hand-edit individual stops** — use `scripts/generate-palette.mjs` (recreate it; it was deleted as a one-off) with `culori`'s oklch ramp + `clampChroma`, eased taper `t**0.55`, so every `600`/`300` neighbor clears AA. Brand base = `#1A1A1A` is achromatic — its ramp is a grey ramp, confirm a near-black primary still reads as "primary" against our orange-trained status colors (the *status* colors carry the warmth now).
2. **Contrast check** — run `node scripts/check-contrast.mjs` against the new 500/600 stops on white and on `#F1F1F1`. Re-run `node scripts/a11y-check.mjs` on `/style-guide`. Keep the light-mode `.light { --ui-*: var(--color-*-600) }` remap where 500 fails 4.5:1.
3. **Spacing/radius/shadow tokens** — add the Polaris shadow set and (only if needed) radius aliases to `@theme static`. Prefer Tailwind's default 4px grid and default radius; don't invent custom spacing steps.
4. **Verify `/style-guide`** — every swatch, type sample, `StatusBadge` state, `PriceDisplay`, `EmptyState` still passes AA in both themes before any feature page builds on it.

## Building storefront pages the Polaris way

When creating pages (marketing home, collections, CMS pages, richer PDP — see `tasks/02-storefront.md` SF-13+), follow these conventions:

- **Layout chrome lives in `app/layouts/default.vue`.** Add the announcement bar, mega-menu/category nav, header search, and footer there — not per-page.
- **Density:** storefront uses the 16px body base (not admin's 14px). Marketing blocks can be airier (section gaps `space-y-20`+) than product grids.
- **Cards/surfaces:** `rounded` (4px) or `rounded-lg` (8px), `1px` hairline border, Polaris shadow `--shadow-polaris-100` for resting cards. Marketing hero blocks can drop the border entirely.
- **Buttons:** primary = `color="primary"` (now near-black), `outline`/`ghost` neutrals for secondary. Avoid colored buttons outside `primary`/status.
- **Money:** always `PriceDisplay` (cents-based, tabular figures). Never format currency inline.
- **Status:** always `StatusBadge` (color + icon + label). Never color-only.
- **Images:** use `@nuxt/image` (`NuxtImg`/`NuxtPicture`), not raw `<img>` — this is the SF-SEO task. Lazy by default, explicit `format="webp"`.
- **SEO:** `useSeoMeta`/`useHead` on every page; JSON-LD `Product`/`ItemList`/`BreadcrumbList` where relevant. Structured data is already proven on the PDP.
- **Empty/loading states:** shared `EmptyState` component. Never bespoke "no results" markup.

## What NOT to do

- Don't `pnpm add @shopify/polaris` or `@shopify/polaris-tokens` — React runtime, wrong framework. The token *values* are documented above.
- Don't hardcode hexes in components — put them in `packages/ui/app/assets/css/main.css` as tokens. A component should reference tokens or Tailwind utilities, never `#1A1A1A`.
- Don't add `dark:` variants with hardcoded colors — the token system handles dark mode; `grep -rn "dark:" apps/ packages/ui` on our own authored files should stay empty (only generated `.nuxt/` output uses `dark:`).
- Don't introduce a second font — Inter + JetBrains Mono is the locked type system.
- Don't invent non-4px spacing or non-default radius steps without a reason.

## Source-of-truth docs

- `tasks/00-design-system.md` — token definitions, principles, the DS task list
- `tasks/00-design-system-plan.md` — the build runbook (commands, file contents, order of ops)
- `tasks/02-storefront.md` — storefront feature tasks (SF-13+ cover the full-store expansion)
- `packages/ui/app/assets/css/main.css` — the actual committed tokens
- `packages/ui/app/pages/style-guide.vue` — live token reference, dev-only
