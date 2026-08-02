# packages/ui

Shared design system — a Nuxt module (`main: './nuxt.config.ts'`), consumed via `extends: ['../../packages/ui']` in both `apps/admin` and `apps/storefront`'s `nuxt.config.ts`. Built on Nuxt UI v4 + Tailwind CSS v4.

## Structure

- `app/assets/css/main.css` — `@import "tailwindcss"; @import "@nuxt/ui";` plus the `@theme static { ... }` block defining the shared color ramps (currently Polaris-derived: `brand` is an achromatic near-black primary, `ink` is a legacy secondary kept for the admin's DS-09 override, status colors regenerated from Polaris hex bases). Ramps were originally generated via an oklch + `clampChroma` eased-taper script per `main.css`'s own header comment (referenced there as `scripts/generate-palette.mjs`, though that script isn't currently present in the repo — check for it before assuming it exists, and if it's gone, treat the comment as documentation of the *method* to reproduce by hand rather than a runnable command). Prefer deriving new stops the same way (oklch, eased taper) over hand-picking arbitrary hex values, to keep the ramp perceptually even.
- `app/app.config.ts` — shared Nuxt UI component defaults/color aliases both apps inherit. Per-app overrides layer on top (see `apps/admin/CLAUDE.md`'s `app.config.ts` note) — this file should stay the common baseline, not accumulate admin- or storefront-specific tuning.
- `app/components/StatusBadge.vue`, `PriceDisplay.vue`, `EmptyState.vue` — genuinely shared components used by both apps. `StatusBadge`'s order-state → color/label mapping is **intentionally frozen 1:1 between admin and storefront** — tracking state the customer sees must match what the admin sees, don't let these drift by patching one side only.
- `app/pages/style-guide.vue` — dev-only live reference for the whole token set, including a demo of the same Zod schema (from `packages/shared`) validating identically on the client and on `apps/api`. Visit via either app's dev server at `/style-guide` when unsure what a token currently resolves to, rather than reading the CSS and guessing.

## Conventions

- This package is Tailwind v4 (`@theme`, native CSS cascade layers) — don't reach for Tailwind v3 config patterns (`tailwind.config.js` theme extension) here; there isn't one.
- A component belongs here only if both apps genuinely use it as-is. Template-specific or admin-specific components belong in that app, not here — this package staying small and truly shared is what keeps the two apps' visual identities from bleeding into each other.
- No top-level `@theme` block outside `main.css` — per-template/per-app token overrides (see `apps/storefront/CLAUDE.md`'s per-template CSS section) are plain scoped custom properties, not additional `@theme` blocks, to avoid Tailwind generating conflicting utility classes for the same token name.

## Dev

No standalone dev server — this package is only run through whichever app `extends` it. Changes here are picked up by both `apps/admin dev` and `apps/storefront dev` directly (no build step for local dev, since it's consumed as a Nuxt layer, not a compiled package like `@amalice/shared`).
