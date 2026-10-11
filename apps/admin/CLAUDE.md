# apps/admin

Nuxt 4 **SPA** (`ssr: false` — this is a back-office tool, not a public page; no SEO/SSR need). Implements the Leezil design in `/design` with hand-owned components (see *UI stack* below).

## Structure

- `app/pages/` — one directory per feature area: `orders`, `products`, `inventory`, `shipping`, `fulfillment`, `call-center`, `reconciliation`, `customers`, `sourcing`, `apps` (integrations), `abandoned-carts`, `audit-log`, `server-performance`, `settings`, `users`.
- `app/stores/auth.ts` — Pinia store holding the JWT session + role.
- `app/middleware/auth.global.ts` — global route guard; only `/login` is public. Per-page role gating via `definePageMeta({ middleware: 'role', requiredRole })`. **This is UX only** — the server (`JwtAuthGuard`/`RolesGuard` in `apps/api`) is the real enforcement boundary; never treat this middleware as the security control.
- `app/tiptap/` — rich-text editor (product descriptions, landing pages) built directly on Tiptap primitives.
- `app/assets/css/leezil.css` + `ads.css` — design tokens/classes + Tailwind entry (admin-only).

## UI stack (Leezil design, no UI framework)

The admin implements the design in `/design` (Leezil brand: Outfit, teal/ivory/brass, 20px cards, pill buttons). It does **not** use `@nuxt/ui` or extend `packages/ui` (storefront-only). Stack: Tailwind v4 (`@tailwindcss/vite`) + Reka UI primitives + TanStack Table + vue-sonner + lucide-vue-next. Light theme only (the design has no dark mode).

- **`app/assets/css/leezil.css`** is `design/assets/css/style.css` ported verbatim (tokens `--teal/--ivory/--brass…`, `.card`, `.kpi`, `.pill`, `.btn`, `.chips`, table styles, responsive rules), loaded in `@layer base/components` so Tailwind utilities can still override per element, plus an "Extensions" block for controls the design doesn't show (forms, modals, destructive buttons) built from the same tokens. When `design/` changes, re-port the changed rules here rather than restyling pages.
- `app/assets/css/ads.css` — Tailwind entry: maps the tokens to utilities (`bg-ads-surface`, `text-ads-subtle`, `text-teal`, `bg-brass`, …) and keeps a small compat layer for older class names (`text-muted`, `admin-kpi-card`, `admin-table`, `tabular`).
- Components: `app/components/ads/` → `<AdsButton>`, `<AdsField>`, `<AdsInput>`, `<AdsSelect>`, `<AdsModal>`/`<AdsDialog>`, `<AdsLozenge>`/`<AdsBadge>`/`<AdsOrderStatus>`, `<AdsKpiCard>`, `<AdsTabs>` (filter chips), `<AdsSearch>`, `<AdsPagination>` (the `.table-foot`), `<AdsPage>` (the `.page-head`). They render the design's classes. Some accept the old Nuxt UI-style props (`color`/`variant`/`label`/`icon`, `items`) — note `<AdsButton>` with none of them is the **primary** style; pass `appearance="default"` for the white secondary button.
- Portaled content (dialogs, selects, popovers) uses the design's `.panel`/`.modal` classes, which don't depend on a wrapper.
- Icons: nav/tab-bar icons come from the design's own set (`lib/design-icons.ts`, `<AdsDesignIcon>`); everything else is `<AdsIcon name="i-lucide-x" />` (lucide at 1.6 stroke), resolved via the generated map in `lib/icons.ts` — add new names there.
- Layout: `layouts/default.vue` = the design's sidebar (248px) / mobile bar / bottom tab bar (+ a "More" drawer, since the admin has more pages than the design's four tabs). Pages use `<AdsPage title description>`; `description` is the small line above the h1.
- Money is shown the design's way ("4,900 DA") via `<AdsPrice>`.
- Toasts: `useToast().add({ title, color })` (adapter in `composables/useToast.ts`) or `toast` from `vue-sonner`; `<Toaster>` is in `app.vue`.
- `useAdminApi()` is deliberately typed as a plain `(url, opts) => Promise<T>` client — inferring full `$fetch` overloads against Nuxt's route types overflows TypeScript's stack.

## Auth

JWT access token TTL is 12h (set in `apps/api`) — this SPA has no silent-refresh flow, so a 401 just clears the session and bounces to `/login`. If you build a refresh flow, that TTL choice should be revisited.

## Dev

```bash
pnpm --filter admin dev      # http://localhost:3001
pnpm --filter admin typecheck
```

`runtimeConfig.public.apiBase` defaults to `http://localhost:3333`; override via `NUXT_PUBLIC_API_BASE` (must match this exact name — see root `CLAUDE.md`'s env-var-naming note).

## Conventions

- Reuse an `Ads*` component before hand-rolling markup; extend the component (or add one in `components/ads/`) rather than repeating long class strings in pages.
- New Tiptap extensions: add the package to `vite.optimizeDeps.include` in `nuxt.config.ts` too, or the first visit to that route triggers a mid-session Vite re-optimization (surfaces as odd module-identity bugs, not a clean error).
- Role gates belong on the page (`definePageMeta`), not scattered `if (auth.role !== ...)` checks inside component bodies — keep the single middleware as the one place route-level access is decided.
- The `stripe-polaris-admin-theme` skill in `.agents/skills/` describes the retired Stripe theme and is obsolete for the admin.
