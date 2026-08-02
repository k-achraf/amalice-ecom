# apps/admin

Nuxt 4 **SPA** (`ssr: false` — this is a back-office tool, not a public page; no SEO/SSR need). Polaris×Stripe hybrid theme (DS-09), built on top of `packages/ui`'s shared Nuxt UI v4 layer.

## Structure

- `app/pages/` — one directory per feature area: `orders`, `products`, `inventory`, `shipping`, `fulfillment`, `call-center`, `reconciliation`, `customers`, `sourcing`, `apps` (integrations), `abandoned-carts`, `audit-log`, `server-performance`, `settings`, `users`.
- `app/stores/auth.ts` — Pinia store holding the JWT session + role.
- `app/middleware/auth.global.ts` — global route guard; only `/login` is public. Per-page role gating via `definePageMeta({ middleware: 'role', requiredRole })`. **This is UX only** — the server (`JwtAuthGuard`/`RolesGuard` in `apps/api`) is the real enforcement boundary; never treat this middleware as the security control.
- `app/tiptap/` — rich-text editor (product descriptions, landing pages) built directly on Tiptap primitives, not `@nuxt/ui`'s `<UEditor>`.
- `app/assets/css/admin.css` — the DS-09 Polaris×Stripe override layer, imported *after* the shared layer's tokens so it wins on equal specificity. Admin-only — the storefront never imports this.
- `app.config.ts` — per-app Nuxt UI component defaults (e.g. tighter button density). Keep additions here minimal and driven by an actual page's need, not speculative.

## Auth

JWT access token TTL is 12h (set in `apps/api`) — this SPA has no silent-refresh flow, so a 401 just clears the session and bounces to `/login`. If you build a refresh flow, that TTL choice should be revisited.

## Dev

```bash
pnpm --filter admin dev      # http://localhost:3001
pnpm --filter admin typecheck
```

`runtimeConfig.public.apiBase` defaults to `http://localhost:3333`; override via `NUXT_PUBLIC_API_BASE` (must match this exact name — see root `CLAUDE.md`'s env-var-naming note).

## Conventions

- Zero `@nuxt/ui` components with hand-rolled Tailwind competing for the same job — use the shared component if one exists in `packages/ui`, extend it via `app.config.ts` before reaching for a one-off.
- New Tiptap extensions: add the package to `vite.optimizeDeps.include` in `nuxt.config.ts` too, or the first visit to that route triggers a mid-session Vite re-optimization (surfaces as odd module-identity bugs, not a clean error).
- Role gates belong on the page (`definePageMeta`), not scattered `if (auth.role !== ...)` checks inside component bodies — keep the single middleware as the one place route-level access is decided.
- See the `stripe-polaris-admin-theme` skill (`.agents/skills/`) before changing tokens/chrome — it encodes the re-theme's specific values and page conventions.
