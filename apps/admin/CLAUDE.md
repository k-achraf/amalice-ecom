# apps/admin

Nuxt 4 **SPA** (`ssr: false` — this is a back-office tool, not a public page; no SEO/SSR need). Implements the Leezil design in `/design` with hand-owned components (see *UI stack* below).

## Structure

- `app/pages/` — one directory per feature area: `orders`, `products`, `inventory`, `shipping`, `fulfillment`, `call-center`, `reconciliation`, `customers`, `blacklist` (shared phone/address blacklist; order-level risk is shown by `components/risk/RiskBadge.vue` in the orders list, call center and `CallWorkspace`, and `RiskPanel.vue` on the order page), `funnels` ("Generate with AI" dialog on the list: product + language + instructions → Draft funnel with a summary of the AI's choices; template picker on create, step editor, Landing-page tab with template gallery + live preview in `components/funnel/`), `sourcing`, `apps` (integrations), `abandoned-carts`, `audit-log`, `server-performance`, `settings`, `users`.
- `app/stores/auth.ts` — Pinia store holding the JWT session + role.
- `app/middleware/auth.global.ts` — global route guard; only `/login` is public. Per-page role gating via `definePageMeta({ middleware: 'role', requiredRole })`. **This is UX only** — the server (`JwtAuthGuard`/`RolesGuard` in `apps/api`) is the real enforcement boundary; never treat this middleware as the security control.
- `app/tiptap/` — rich-text editor (product descriptions, landing pages) built directly on Tiptap primitives.
- `app/assets/css/leezil.css` + `ads.css` — design tokens/classes + Tailwind entry (admin-only).

## UI stack (Leezil design, no UI framework)

The admin implements the design in `/design` (Leezil brand: Outfit, teal/ivory/brass, small radii (8/6/4px), square markers). It does **not** use `@nuxt/ui` or extend `packages/ui` (storefront-only). Stack: Tailwind v4 (`@tailwindcss/vite`) + Reka UI primitives + TanStack Table + vue-sonner + lucide-vue-next. Light theme only (the design has no dark mode).

- **`app/assets/css/leezil.css`** is `design/assets/css/style.css` ported verbatim by `scripts/port-design-css.py` (tokens `--teal/--ivory/--brass…`, `.card`, `.kpi`, `.pill`, `.btn`, `.chips`, `.tabs`, forms, `.modal`/`.drawer`, `.savebar`, tables, responsive rules), loaded in `@layer components` so Tailwind utilities can still override per element. It has no hand-written additions: when `design/` changes, re-run the script (`python scripts/port-design-css.py`) rather than restyling pages.
- `app/assets/css/ads.css` — Tailwind entry: maps the tokens to utilities (`bg-ads-surface`, `text-ads-subtle`, `text-teal`, `bg-brass`, …) and keeps a small compat layer for older class names (`text-muted`, `admin-kpi-card`, `admin-table`, `tabular`).
- Components: `app/components/ads/` → `<AdsButton>`, `<AdsField>`, `<AdsInput>`, `<AdsSelect>`, `<AdsModal>`/`<AdsDialog>`/`<AdsDrawer>`, `<AdsLozenge>`/`<AdsBadge>`/`<AdsOrderStatus>`, `<AdsKpiCard>`, `<AdsTabs>` (filter chips), `<AdsSearch>`, `<AdsPagination>` (the `.table-foot`), `<AdsPage>` (the `.page-head`). They render the design's classes. Some accept the old Nuxt UI-style props (`color`/`variant`/`label`/`icon`, `items`) — note `<AdsButton>` with none of them is the **primary** style; pass `appearance="default"` for the white secondary button.
- Dialogs and drawers render the design's `.overlay`/`.modal`/`.drawer`; `<AdsSelect>` is the design's native `.select` (null/number option values round-trip; `multiple` renders a checklist).
- Design reference for each page lives in `design/` (HTML + `assets/js/pages/*.js`); the admin pages mirror those layouts and fill them from the real API. Where the API has no data for a design widget (revenue chart, wilaya sales, funnel, auto-reminder…) the widget is omitted, not faked.
- Icons: nav/tab-bar icons come from the design's own set (`lib/design-icons.ts`, `<AdsDesignIcon>`); everything else is `<AdsIcon name="i-lucide-x" />` (lucide at 1.6 stroke), resolved via the generated map in `lib/icons.ts` — add new names there.
- Layout: `layouts/default.vue` = the design's sidebar (248px, groups per `design/assets/js/app.js` NAV) / mobile bar with a slide-out menu / bottom tab bar (Home, Orders, Calls, Products, More). Pages use `<AdsPage title description>`; `description` is the small line above the h1.
- Money is shown the design's way ("4,900 DA") via `<AdsPrice>`.
- Toasts: `useToast().add({ title, color })` (adapter in `composables/useToast.ts`) or `toast` from `vue-sonner`; `<Toaster>` is in `app.vue`.
- `useAdminApi()` is deliberately typed as a plain `(url, opts) => Promise<T>` client — inferring full `$fetch` overloads against Nuxt's route types overflows TypeScript's stack.

## Brand identity

`pages/settings/brand.vue` (SuperAdmin; nav: Online store → Brand identity): upload a logo (auto-runs `POST /admin/settings/brand/analyze-logo` → palette, primary colour, AI font suggestion), edit the primary colour (hex + picker + generated 50–950 ramp + white-text contrast warning), pick the typeface (10 Arabic Google Fonts, previewed live), favicon, live preview. Saves through `PUT /admin/settings/brand` — not the storefront settings PUT. The brand also re-skins the admin itself: `plugins/brand.client.ts` → `composables/useAdminBrand.ts` fetches the public `/settings` on boot (cached in localStorage), sets `--teal/--pine/--sage/--mist/--text-2` from `deriveAdminTheme` (teal darkened until white text passes 4.5:1), `--font`, the favicon, and shows the logo on an ivory chip in the sidebar/login. `leezil.css` is untouched. Shapes/ramp maths live in `packages/shared/src/store-settings.ts` (`BrandSchema`, `BRAND_FONTS`, `buildColorRamp`).

## AI models (settings)

`pages/settings/ai.vue` (SuperAdmin; nav: Online store → AI models): one card per AI service that already has a key, and an **Add a service** picker for the rest (Gemini, Groq, Cerebras, GitHub Models, NVIDIA NIM, SambaNova, OpenRouter, Mistral, Hugging Face, Z.ai and a **Custom endpoint** with a base URL field and an optional key), each with a write-only API key field (saved encrypted, only "…last4" shown), **Test connection** (lists the provider's live models, which also proves the key) and Remove; then Fast / Smart / Fallback model pickers (only services with a key are offered; choosing one pre-fills a suggested model, the model box has a datalist of the live list) with a per-tier **Test** (one tiny real request against the *saved* settings, so it's disabled while the form is dirty); and the daily request limit. API: `admin/ai/settings|providers|test` (see `apps/api/CLAUDE.md`).

## AI assistant

`pages/ai/index.vue` (nav: AI → AI assistant; SuperAdmin/OpsManager/Finance): chat that asks `POST /admin/ai/assistant` (answers come from read-only data tools on the API; "Based on …" shows which). The model's light markdown is HTML-escaped first and only then turned into bold/italic/bullets. The conversation (last 30 turns) is kept in this browser's `localStorage` (`amalice.ai.chat`) — a per-viewer convenience, "New chat" clears it. The footer shows today's AI request count (`GET /admin/ai/usage`). The order page has a **Suggest** button on the shipping-address card (`POST /admin/orders/:id/address-suggestion`): a dialog compares the stored wilaya/commune/address line with the AI's match against the real lists and **Apply** sends only the differing fields through the audited `PATCH /admin/orders/:id/customer-info`.

The courier card (`components/ShipmentPanel.vue`) has an **Analyze notes with AI** button (`POST /admin/orders/:id/delivery-triage`) that shows the problem category, a summary and the suggested next step above the courier history. New risk factors `FAKE_NAME`/`FAKE_ADDRESS` appear in the risk panel through `RISK_FACTOR_LABELS`.

`pages/ai/ad-copy.vue` (nav: AI → Meta ad copy; SuperAdmin/OpsManager) generates Meta ad angles for a product with copy buttons. The funnel Stats tab starts with a **Next test** card (`components/funnel/NextTest.vue`), and the sourcing detail page has a **Research analysis** card (`components/sourcing/Analysis.vue`, on demand).

## Reports & alerts

`pages/settings/reports.vue` (SuperAdmin; nav: Online store → Reports & alerts): Telegram bot token/chat id, daily-summary hour, max cost per order, wilaya return-rate and courier-silence thresholds. API: `admin/reports/*` (see `apps/api/CLAUDE.md`).

## Call center

`pages/call-center/index.vue` (queues, paginated, search, 30 s refresh), `drop.vue` (server-claimed one-at-a-time dialer, shortcuts 1–5/S/N) and `reports.vue` (managers) all work an order through the shared `components/CallWorkspace.vue` — outcomes go to `POST /admin/orders/:id/call` (never the generic transition endpoint, which rejects same-state retries). Message templates / WhatsApp+SMS links and cancel reasons live in `packages/shared/src/call-center.ts`.

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
