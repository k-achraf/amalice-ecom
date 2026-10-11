# apps/admin

Nuxt 4 **SPA** (`ssr: false` — this is a back-office tool, not a public page; no SEO/SSR need). Atlassian-style design system, hand-owned components (see *UI stack* below).

## Structure

- `app/pages/` — one directory per feature area: `orders`, `products`, `inventory`, `shipping`, `fulfillment`, `call-center`, `reconciliation`, `customers`, `sourcing`, `apps` (integrations), `abandoned-carts`, `audit-log`, `server-performance`, `settings`, `users`.
- `app/stores/auth.ts` — Pinia store holding the JWT session + role.
- `app/middleware/auth.global.ts` — global route guard; only `/login` is public. Per-page role gating via `definePageMeta({ middleware: 'role', requiredRole })`. **This is UX only** — the server (`JwtAuthGuard`/`RolesGuard` in `apps/api`) is the real enforcement boundary; never treat this middleware as the security control.
- `app/tiptap/` — rich-text editor (product descriptions, landing pages) built directly on Tiptap primitives.
- `app/assets/css/ads.css` — design tokens + Tailwind entry (admin-only).

## UI stack (Atlassian-style, no UI framework)

The admin does **not** use `@nuxt/ui` or extend `packages/ui` (that layer is storefront-only). It is Tailwind v4 (`@tailwindcss/vite` in `nuxt.config.ts`) + Reka UI primitives + TanStack Table + vue-sonner + lucide-vue-next.

- Tokens: `app/assets/css/ads.css` — semantic CSS vars (light + `.dark`) exposed as `bg-ads-surface`, `text-ads-subtle`, `border-ads-border`, … It also keeps a small compat layer for older class names (`text-muted`, `text-highlighted`, `admin-kpi-card`, `admin-table`, `tabular`, …) so templates written before the redesign still resolve.
- Components: `app/components/ads/` → auto-imported as `<AdsButton>`, `<AdsField>`, `<AdsInput>`, `<AdsSelect>`, `<AdsModal>`/`<AdsDialog>`, `<AdsBadge>`/`<AdsLozenge>`, `<AdsOrderStatus>`, `<AdsPagination>`, `<AdsKpiCard>`, … Several accept the old Nuxt UI-style props (`color`/`variant`/`label`/`icon`, `items`) on purpose.
- Portaled content (dialogs, selects, menus) must carry the `ads-root` class so tokens apply outside the layout root.
- Icons: `<AdsIcon name="i-lucide-x" />` resolves against the generated map in `app/lib/icons.ts` — add the icon there (import from `lucide-vue-next`) when you use a new name.
- Layout: `layouts/default.vue` (top bar + grouped sidebar). Pages wrap content in `<AdsPage title="…">` with optional `#actions` / `#breadcrumb` slots.
- Toasts: `useToast().add({ title, color })` (adapter in `composables/useToast.ts`) or `toast` from `vue-sonner`; the `<Toaster>` lives in `app.vue`.
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
