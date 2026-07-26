---
name: stripe-polaris-admin-theme
description: Adopt a hybrid Shopify Polaris × Stripe design language for this project's Nuxt 4 + Nuxt UI v4 admin dashboards WITHOUT using React. Use whenever building admin pages, dashboards, data tables, KPI cards, filters, order/inventory/reconciliation/courier screens, re-theming the admin, or anyone mentions Polaris admin, Stripe dashboard, or building dashboards/admin for this project.
---

# Stripe × Polaris hybrid theme (admin)

How to make `apps/admin` look like a Stripe dashboard built with Polaris discipline — **without** React. We adopt the *tokens and look* of both, applied to Nuxt UI v4's primitives. Don't reach for `@shopify/polaris` or Stripe's React components.

This project's theming lives in `packages/ui` (a shared Nuxt layer). The admin will get its own **theme override layer** (`apps/admin/app/assets/css/admin.css` + an admin `app.config.ts`) layered *on top of* the shared tokens — because the storefront and admin now diverge: storefront is Polaris, admin is Polaris×Stripe. Read [`tasks/00-design-system.md`](../../../tasks/00-design-system.md) (DS-09) and [`tasks/03-admin-core.md`](../../../tasks/03-admin-core.md) for the plan.

## When to use this skill

- Adding or editing any admin page under `apps/admin/app/pages/`
- Building dashboards, data tables, KPI/stat cards, filter bars, detail drawers
- Re-theming the admin or wiring the admin override layer
- Anyone says "Polaris admin", "Stripe dashboard", "dashboards", "admin"

## The hybrid (why both, not one)

- **Polaris supplies the skeleton and density discipline:** 4px spacing grid, hairline 1px borders, restrained palette, flat-but-layered shadows, high information density, 14px body text. This is the structural foundation.
- **Stripe supplies the surface treatment and color personality:** the `#F6F9FC` off-white page background, the `#635BFF` indigo primary (replaces Polaris's near-black for *actions* — more clickable, more "SaaS dashboard"), the signature soft navy-based shadows, the lilac-wash row hover, the comfortable-but-dense table styling. This is what makes it feel like Stripe, not a generic admin.

The result reads as a Stripe dashboard with Polaris's structural rigor — high density, no fluff, but warmer and more clickable than raw Polaris.

## Token values (2025/2026)

### Color
| Role | Hex | Maps to |
|---|---|---|
| **Primary (Stripe indigo)** | `#635BFF` | `--ui-primary` (admin override) — primary buttons/links |
| Primary hover | `#4F46E5` | primary-700 |
| **Page background** | `#F6F9FC` (Black Squeeze) | admin `<main>` bg |
| Card / surface | `#FFFFFF` | cards, table rows |
| Subtle lilac panel/hover | `#F4F1FF` | row hover, selected-row tint |
| Deep navy (dark surface) | `#0A2540` | dark-mode surfaces, dark headers |
| Text primary | `#0A2540` | — |
| Text secondary/muted | `#425466` | — |
| Text tertiary/disabled | `#8898AA` | — |
| Border / row separator | `#E3E8EE` (1px) | table rows, card borders |
| Success | `#00875A` (tint bg `#E3F7E8`) | — |
| Warning | `#DC9D15` (tint bg `#FFF4E0`) | — |
| Danger/critical | `#DF1B41` (tint bg `#FCE7EC`) | destructive actions |
| Info | reuse indigo `#635BFF` (tint bg `#EFEFFB`) | — |

> **Order/shipping status colors** still come from the shared `StatusBadge` (DS-05) — do NOT re-skin order lifecycle colors per-app. The admin override only changes primary/surface/shadow/typography, not the semantic status palette.

### Typography
- **Inter** (already self-hosted) — closest free match to Stripe's licensed Söhne. Mono: **JetBrains Mono** (already wired) for IDs, SKUs, courier refs.
- **Admin body = 14px** (Polaris density), line-height ~1.45. Weights: 400 body, 500 labels (Stripe's workhorse), 600 buttons, 700 headings.
- Type scale: 11, 12, **14**, 16, 18, 20, 24, 28, 32, 40, 48px. Avoid 300.

### Spacing & radius
- 4px base (Polaris) — Tailwind's default grid already covers it. No custom steps.
- Radius: **6px default** for components/buttons/inputs (Stripe's signature), 4px for chips, 8–10px for cards/modals, full pill only for badges/avatars. Add `--radius-admin` aliases if the storefront's 4px default needs overriding.

### Shadows (Stripe signature — soft, layered, navy-based)
Put these in the admin override CSS, **not** shared tokens (storefront keeps Polaris's `rgba(26,26,26,*)` greys):
```css
--shadow-admin-sm: 0 1px 2px rgba(10,37,64,.06), 0 1px 3px rgba(10,37,64,.04);
--shadow-admin-md: 0 4px 10px rgba(10,37,64,.06), 0 2px 6px rgba(10,37,64,.05);
--shadow-admin-lg: 0 10px 30px rgba(10,37,64,.10), 0 4px 12px rgba(10,37,64,.06);
```
Key: shadow color is **navy `#0A2540`-based**, opacity 4–12%. Never pure black, never heavy.

## Stripe-style data tables (the core admin surface)

Order queue, reconciliation grid, inventory — all follow the Stripe dashboard table look:
- **No harsh zebra striping.** White rows on `#F6F9FC` page bg; subtle `#FAFBFD` alternate tint only if needed.
- **Header:** `#425466` text, 11–12px, weight 500, hairline 1px `#E3E8EE` bottom border. Avoid uppercase shouting.
- **Row separators:** 1px `#E3E8EE`. Row height ~44–48px, 16px horizontal cell padding.
- **Hover:** subtle `#F4F1FF` lilac wash — very gentle, this is the Stripe tell.
- **Numbers:** right-aligned, tabular figures (`PriceDisplay` / `.tabular`).
- **Status:** small pill badges via shared `StatusBadge` (color + icon + label).
- **Selected row:** 2px indigo left border or `#EFEFFB` fill.
- Use Nuxt UI `UTable` + a `ClassData`/cell-render config — don't reach for a table library unless virtualization is needed (it isn't until thousands of rows; even then try `UTable` virtualization first).

## How to wire the admin override (the DS-09 task)

The shared `packages/ui` stays Polaris-default (storefront). The admin layers on top:

1. **`apps/admin/app/assets/css/admin.css`** — override `--ui-primary`, add `--shadow-admin-*`, `--radius-admin`, page background. Import it in `apps/admin/nuxt.config.ts` (`css: ['~/app/assets/css/admin.css']`) *after* the layer's `main.css`.
2. **`apps/admin/app/app.config.ts`** — per-app component defaults (tighter table padding, smaller button density, badge variants) via Nuxt UI's `ui.*` config. This file doesn't exist yet — create it.
3. **`#F6F9FC` page bg** — set on the dashboard layout root, not globally, so `/style-guide` (shared) keeps the storefront look.
4. **Verify** `/style-guide` in *both* apps still passes — the admin override must not leak into the storefront (scope new tokens to the admin app, don't edit shared `main.css`'s status/brand ramps).

## Building admin pages

Dashboard shell already exists (`apps/admin/app/layouts/default.vue` — `UDashboardGroup` + `UDashboardSidebar` with 6 nav routes pre-wired). Adding a page at `app/pages/<route>.vue` auto-populates the nav. Conventions:

- **Auth-first:** admin pages need RBAC (ADM-02). Until login exists (ADM-03), a page renders but isn't gated — note this, don't fake the gate client-side.
- **Data fetching:** add an admin composable (`apps/admin/app/composables/useAdminApi.ts`) mirroring the storefront's `useApi.ts`, with the JWT bearer from the (forthcoming) auth store. Don't bypass it with raw `$fetch`.
- **KPI cards:** `UCard` + `--shadow-admin-sm`, big tabular number, label above, delta below with up/down icon + semantic color.
- **Charts:** check the installed deps before adding a lib — none is yet. Prefer a lightweight one (Unovis / `@unovis/vue`) and confirm SSR=false compatibility.
- **Filter bars:** a `UCard` row of `UInput`/`USelect`/`UDatePicker` above the table; filters round-trip through the URL query like the storefront catalog does.
- **Detail views:** `USlideover` for quick view, full page for deep detail. Order detail (ADM-05) is a full page with a status timeline.
- **Money/IDs:** always `PriceDisplay` / `.tabular`. Never inline-format.
- **Empty states:** shared `EmptyState`.
- **Bulk actions:** row checkboxes + an action bar; never require opening each row.

## What NOT to do

- Don't `pnpm add @shopify/polaris`, `@shopify/polaris-tokens`, or Stripe's React components — wrong framework. Token *values* are documented above.
- Don't edit `packages/ui/app/assets/css/main.css` for admin-only tokens — that's shared with the storefront. Admin overrides go in `apps/admin/app/assets/css/admin.css`.
- Don't re-skin `StatusBadge` / order-lifecycle colors in the admin — those are shared domain semantics. Override only primary/surface/shadow/type/density.
- Don't use pure-black or heavy shadows — navy `#0A2540`-based, low opacity.
- Don't add a second font — Inter + JetBrains Mono is locked.
- Don't invent non-4px spacing or add a table library without trying `UTable` first.

## Source-of-truth docs

- `tasks/00-design-system.md` (DS-09) — the admin override task + rationale
- `tasks/03-admin-core.md` — admin feature tasks (ADM-01..08)
- `tasks/05-cash-reconciliation.md`, `tasks/04-fulfillment-courier.md` — the dashboards this theme serves
- `apps/admin/app/layouts/default.vue` — existing dashboard shell
- `packages/ui/app/components/StatusBadge.vue` — shared status semantics (do not override)
