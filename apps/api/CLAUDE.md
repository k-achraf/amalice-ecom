# apps/api

NestJS 11 + Prisma 7 + Postgres backend. Feature-module-per-domain layout under `src/`; validation via `nestjs-zod` against the schemas in `packages/shared`, not hand-rolled DTOs.

## Modules (`src/`)

| Module | Covers |
|---|---|
| `identity/admin-auth` | Admin login, JWT issuance/refresh, `JwtAuthGuard`, `RolesGuard` |
| `catalog` | Products, categories, reviews, search |
| `orders`, `order-items` | Order lifecycle, line items, upsells |
| `admin/admin-call-center.service.ts` | Call center: server-side drop-queue claiming with expiring locks (`claim-next`, `lock`, `release`, `skip`), call logging (`POST orders/:id/call` → `CallAttempt` row, atomic on the state it read), progressive no-answer cooldown + max attempts (`packages/shared/src/call-center.ts`), customer history, team/agent stats and manager report (Algiers day = UTC+1). `CallCenterAgent` is confined to call-center states in `listOrders`/`orderDetail`/`transition` |
| `fulfillment` | Fulfillment/shipping workflow (call center → ship → deliver) |
| `shipping-companies` | Carrier integrations, tariffs. DHD, Swift Express, Anderson and 48 Hr Express all speak the same Ecotrack API (one client, `DhdApiService`); each is just a provider in `SHIPPING_COMPANY_CATALOG` (`packages/shared/src/shipping-company.ts`) with its own base URL and webhook slug. To add another Ecotrack courier: add it to that catalog + the `ShippingCompanyProvider` Prisma enum (migration) + an icon in the admin's `shipping-companies.vue` |
| `fulfillment` (courier sync) | All four Ecotrack couriers share `DhdApiService` (rate-limited to 45 req/min, 429 retry, French errors translated). `FulfillmentService` adds: address check against the courier's synced commune list (`ShippingCompanyCommune`, `POST admin/shipping-companies/:provider/sync-locations`), create + optional confirm (`valid/order`, recorded as `Shipment.carrierConfirmedAt`; edits/deletes locked after), status reads only on demand (order page opens once / Refresh button, Delivery details = one `get/trackings/info` per company; no polling, no scheduler — webhooks push changes) walking the order through legal states via `COURIER_STATUS_TO_ORDER_STATE`, courier fees, driver/desk/failed-attempt details, notes (`add/maj`) and return requests. `STATES_REQUIRING_SHIPMENT`: no HandedToCourier/OutForDelivery without a Shipment |
| `admin/admin-order-timeline.service.ts` | Order tracking: `GET admin/orders/:id/timeline` merges AuditLog (status changes, edits, shipping actions), `CallAttempt`, `ShipmentEvent` (permanent courier history — written by status sync/refresh, deduped by `dedupKey`), webhook deliveries, notifications and finance rows into one chronological list with milestones; `GET admin/orders/activity` is the paged cross-order feed. New order operations must write an `AuditLog` row (entity `Order`) to show up |
| `landing-pages` (AI pages) | Pages are *composed*, not painted: Gemini writes copy (brief → draft → code validation in `landing-copy.util.ts` (language, dialect, invented numbers/promos) → proofread until two passes agree, retried with feedback, plain fallback); every section is the product's own photo, enhanced by code and (Gemini provider) retouched by the image model (light/colour/sharpness, overlaid foreign captions/banners/watermarks removed, vision-checked against the original, falls back to the code-enhanced photo); `landing-page-render.util.ts` draws the copy directly on that photo with the bundled Cairo font (`assets/fonts`, needs `process.cwd()` = apps/api) over a gradient. No backgrounds are generated. Copy edits (`PUT admin/landing-pages/:id/sections/:sectionId`) and restyles re-render instantly with no AI call. Providers: Gemini (retouches photos) / Pollinations / Template (code enhancement only) |
| `reconciliation` | COD cash reconciliation |
| `locations` | Wilaya/Commune reference data (Algeria) |
| `funnels` | Product funnels (admin CRUD only): ordered steps created from a template in `packages/shared` (`FUNNEL_TEMPLATES`). Not served to the storefront yet. Per-funnel stats: `GET admin/funnels/:id/stats?days=` (`funnels-stats.service.ts`) — visits/engagement from `PageViewEvent` rows (`type=Funnel`, `entityId`=funnel id; `durationSeconds`/`scrollDepth`/`startedForm` filled by `POST analytics/engagement`, `deviceType`/`source`/`campaign` at view time) and sales from `Order.funnelId` (set server-side in `FunnelsPublicService.placeOrder`; `GET admin/orders?funnelId=` lists them) |
| `sourcing` | Product-sourcing research/tracking (separate from live catalog) |
| `apps` | Third-party integrations: Meta Conversions API, TikTok Events API, Google Sheets |
| `landing-pages` | AI-generated product landing pages (Gemini) |
| `server-performance` | Server resource/perf monitoring endpoints (admin dashboard) |
| `store-settings` | Public storefront config (active template, store name, etc.) — `/settings`, exempt from throttling |
| `notifications` | OTP delivery — `ConsoleOtpProvider` in dev (logs to terminal), swap for a real SMS provider before launch |
| `common` | Audit log service, global exception filters |
| `redis` | Redis/BullMQ wiring |
| `admin` | Admin-only cross-cutting endpoints (users, audit log) |
| `prisma` | `PrismaService` wrapper |
| `generated` | Prisma client output — **never hand-edit**, regenerate via `prisma generate` |

## Dev server (`pnpm dev`)

`pnpm dev` = `tsc --watch` + `scripts/dev-server.mjs`, a small supervisor (not `node --watch`, which never restarts a crashed process). It waits for Postgres and Redis from `.env` before booting, restarts the API when `dist/` is rebuilt, and restarts it after a crash. If the admin/storefront show `ERR_CONNECTION_REFUSED` on `:3333`, check that Docker is up (`docker compose up -d`) — the supervisor logs `waiting for Postgres/Redis` until it is.

## Env vars (`src/config`)

Validated via Zod at boot (`validateEnv`) — an invalid/missing required var crashes startup immediately with a clear message rather than failing three requests in. See `src/config/*.ts` for the full schema. Notably:
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — min 32 chars, no code-level defaults (a placeholder default is how it quietly ends up in production).
- `GEMINI_API_KEY` — optional; AI landing-page builder degrades to a clear "not configured" error rather than failing boot.
- `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` — optional together; feature no-ops (order pushes silently skip) rather than failing checkout. Keep `PRIVATE_KEY`'s literal `\n` escapes as-is — unescaped at read time.

## CORS

Hardcoded in `src/main.ts` (`app.enableCors`) — `amalice.shop` / `www.amalice.shop` / `admin.amalice.shop` always, plus `localhost:3000`/`localhost:3001` (storefront/admin dev servers) whenever `NODE_ENV !== 'production'`. If you add a new storefront/admin domain (staging, a new tenant, etc.), it has to be added here explicitly or requests will fail with an opaque CORS error, not a helpful one. Only client-side (browser) fetches go through this at all — SSR calls (Nuxt server-to-server) are unaffected, which is why a CORS gap here only ever shows up on client-only calls (login, wilaya/commune pickers, etc.), never on a page that renders fully server-side.

## Uploads

Served statically from `<cwd>/uploads` at `/uploads/*` (`main.ts`). This directory only exists on the API server — a relative `/uploads/...` URL is never resolvable directly by either Nuxt app; they must resolve it against `apiBase` first (see `apps/storefront/CLAUDE.md`'s `resolveImageUrl()` note). This has caused real broken-image bugs before — don't pass a raw `imageUrl` straight to an `<img>`/`<NuxtImg>` in either frontend.

## Prisma workflow

```bash
cd apps/api
npx prisma format
npx prisma migrate dev --name descriptive_name
npx prisma generate
```

Seeding:
- `pnpm exec prisma db seed` — full dev seed (sample products, customer, one admin per role, **creates dev-password admin accounts** — do not run against production).
- `pnpm seed-locations` — Wilaya/Commune reference data only, safe for production (no dev credentials).
- `pnpm create-admin` — standalone script to create a single admin account (argv-parsed; if invoking via `pnpm create-admin -- --email=...`, note pnpm forwards the `--` separator itself into `process.argv`).

## Auth

Admin JWT access tokens: 12h TTL (`ACCESS_TOKEN_TTL` in `admin-auth.service.ts`) — deliberately long since the admin SPA has no silent-refresh flow; a 401 just clears session and bounces to `/login`. Refresh token TTL: 7d. If you add a silent-refresh flow, the access-token TTL is a reasonable thing to shorten back down.

## Pixel/CAPI events (Meta + TikTok)

`src/apps/meta-conversions-api.service.ts` and `tiktok-events-api.service.ts`, invoked from `orders.service.ts`'s `sendPurchaseEvents`. Both platforms **deduplicate** browser-pixel and server-side events sharing the same `event_id` — sending from both channels is intentional redundancy against ad-blockers/ITP, not double-counting, as long as the id matches what the storefront sends (currently `orderId`, wired in both places).

TikTok's schema is easy to get wrong: `content_id` must live inside `properties.contents[]` (array, one entry per line item — `content_id`, `content_type`, `quantity`, `price`), **not** a flat `properties.content_id`. A flat shape fails TikTok's validation silently from our side (shows as "Content ID is missing" in their dashboard, not a request error here).

## Order attribution (ad source)

Every order (checkout, lead, abandoned, funnel) gets an `OrderAttribution` row (`OrdersService.recordAttribution`, best-effort — never fails an order): platform (derived in `orders/order-attribution.util.ts`: click ids → `utm_source` → referrer), campaign/ad set/ad ids+names, utm_*, fbclid/ttclid/gclid, fbp/fbc/ttp, landing URL, referrer, visitor id, IP (proxy headers via `clientIp`), user agent, first touch. The browser side lives in `apps/storefront` (`useAttribution` + `plugins/attribution.client.ts`) and `apps/funnels/src/client.js`, sent as `tracking.attribution`. Campaign/ad ids are only known if the ad's URL carries them (`campaign_id`, `adset_id`, `ad_id`, `placement`, utm_* — see `packages/shared/src/attribution.ts`). Shown in admin on the order page ("Order source") and as a Source column in the orders list.

## Meta Ads section (admin)

`src/meta-ads` — phase 1, read-only. **Two ways to link an account, both set up from the admin UI (no code/.env edits):** (1) paste an access token (`POST admin/meta-ads/connect-token`: Graph API Explorer token or a Business Manager System User token; validated against `me` + `me/adaccounts`, extended to ~60 days when a Meta app is saved); (2) Facebook login, which needs the Meta app's ID + secret saved from the UI (`PUT admin/meta-ads/app-credentials`, SuperAdmin, secret encrypted in `MetaAppCredentials`; `META_APP_ID`/`META_APP_SECRET` env remain a fallback — `MetaCredentialsService`). The Facebook-login flow: each admin (SuperAdmin/OpsManager) links their own Facebook account: the admin SPA sends them to Meta's OAuth dialog (`GET admin/meta-ads/oauth-url`), Meta redirects to the admin's `/meta-ads/callback`, which posts the `code` to `POST admin/meta-ads/connect` (no public callback on the API). The long-lived token is stored AES-256-GCM encrypted (`meta-crypto.ts`, key from `META_TOKEN_ENCRYPTION_KEY` or derived from `JWT_SECRET`) and every Graph call carries `appsecret_proof`. Ad accounts are synced into `MetaAdAccount`; campaigns and insights are read live from the Graph API (60 s Redis cache), never stored. A Graph error 190 flips the connection to `Expired` (UI asks to reconnect) — it returns 409, not 401, because the admin SPA logs out on any 401. Needs `META_APP_ID` / `META_APP_SECRET` and the admin callback URL in the Meta app's Valid OAuth Redirect URIs; `ads_read` works only for the app's own roles until Meta approves Advanced Access.

## Style

- Prefer NestJS's DI/module conventions over ad hoc singletons.
- Validate everything at the controller boundary via the shared Zod schema, not a hand-rolled `class-validator` DTO — that's the entire point of `packages/shared`.
- `@SkipThrottle()` is used for genuinely public, high-frequency, low-risk endpoints (e.g. `/settings`) — don't add it reflexively; the default throttle exists for a reason.
