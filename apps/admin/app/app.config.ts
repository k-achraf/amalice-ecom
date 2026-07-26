/*
 * DS-09 — per-app Nuxt UI component defaults for the admin.
 * Merges on top of packages/ui's shared app.config.ts (which holds the color
 * aliases). ADMIN-ONLY: nothing here affects the storefront (the storefront
 * has no app.config.ts of its own and just inherits the shared layer).
 *
 * Defaults are intentionally minimal here — the real table/button/badge
 * density tuning lands as concrete admin pages (ADM-04+) reveal what's
 * needed, same discipline as DS-07's deferred Input/Select audit. Don't
 * fabricate component config for components no page renders yet.
 */
export default defineAppConfig({
  ui: {
    // Button: Polaris density — slightly tighter than the storefront default.
    button: {
      defaultVariants: { size: 'sm' }
    }
  }
})
